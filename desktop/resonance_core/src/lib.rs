#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

// Import math operations from JS environment for stable no_std compilation
extern "C" {
    fn cosf(x: f32) -> f32;
    fn sinf(x: f32) -> f32;
    fn atan2f(y: f32, x: f32) -> f32;
    fn expf(x: f32) -> f32;
    fn sqrtf(x: f32) -> f32;
}

pub const D: usize = 4096;
pub const MAX_VOCAB: usize = 1024;
pub const PI: f32 = 3.141592653589793f32;

// Shared mutable buffers in Wasm linear memory
#[no_mangle]
pub static mut CONTEXT_ANGLES: [f32; D] = [0.0; D];

#[no_mangle]
pub static mut TRANSITION_SPEC_RE: [f32; D] = [0.0; D];

#[no_mangle]
pub static mut TRANSITION_SPEC_IM: [f32; D] = [0.0; D];

#[no_mangle]
pub static mut QUERY_ANGLES: [f32; D] = [0.0; D];

// External linker symbol for dynamic heap base address
extern "C" {
    static __heap_base: u8;
}

static mut HEAP_PTR: usize = 0;

#[no_mangle]
pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
    if HEAP_PTR == 0 {
        HEAP_PTR = &__heap_base as *const u8 as usize;
    }
    // 16-byte memory alignment for optimal SIMD vector operations
    let align = 16;
    let aligned_ptr = (HEAP_PTR + align - 1) & !(align - 1);
    let next_ptr = aligned_ptr + size;
    
    // Automatically grow Wasm linear memory pages if heap pointer goes out of current bounds
    let current_pages = core::arch::wasm32::memory_size(0);
    let current_bytes = current_pages * 65536;
    if next_ptr > current_bytes {
        let needed_bytes = next_ptr - current_bytes;
        let needed_pages = (needed_bytes + 65535) / 65536;
        if core::arch::wasm32::memory_grow(0, needed_pages) == usize::MAX {
            return core::ptr::null_mut();
        }
    }
    
    HEAP_PTR = next_ptr;
    aligned_ptr as *mut u8
}

// Static buffer address getters for JS environment
#[no_mangle]
pub extern "C" fn get_context_angles_ptr() -> *mut f32 {
    unsafe { CONTEXT_ANGLES.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn get_transition_spec_re_ptr() -> *mut f32 {
    unsafe { TRANSITION_SPEC_RE.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn get_transition_spec_im_ptr() -> *mut f32 {
    unsafe { TRANSITION_SPEC_IM.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn get_query_angles_ptr() -> *mut f32 {
    unsafe { QUERY_ANGLES.as_mut_ptr() }
}

// In-place iterative Cooley-Tukey Radix-2 FFT
unsafe fn fft_in_place(re: &mut [f32; D], im: &mut [f32; D], invert: bool) {
    let n = D;
    
    // 1. Bit reversal permutation
    let mut j = 0;
    for i in 0..n {
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
        let mut m = n >> 1;
        while m >= 1 && j >= m {
            j -= m;
            m >>= 1;
        }
        j += m;
    }
    
    // 2. Cooley-Tukey Butterfly merge
    let mut len = 2;
    while len <= n {
        let angle = 2.0 * PI / (len as f32) * (if invert { -1.0 } else { 1.0 });
        let wlen_re = cosf(angle);
        let wlen_im = sinf(angle);
        let half = len >> 1;
        
        for i in (0..n).step_by(len) {
            let mut w_re = 1.0f32;
            let mut w_im = 0.0f32;
            for k in 0..half {
                let u_re = re[i + k];
                let u_im = im[i + k];
                
                let target_re = re[i + k + half];
                let target_im = im[i + k + half];
                
                // Complex multiplication: t = w * target
                let t_re = target_re * w_re - target_im * w_im;
                let t_im = target_re * w_im + target_im * w_re;
                
                re[i + k] = u_re + t_re;
                im[i + k] = u_im + t_im;
                re[i + k + half] = u_re - t_re;
                im[i + k + half] = u_im - t_im;
                
                // Update w = w * wlen
                let next_w_re = w_re * wlen_re - w_im * wlen_im;
                let next_w_im = w_re * wlen_im + w_im * wlen_re;
                w_re = next_w_re;
                w_im = next_w_im;
            }
        }
        len <<= 1;
    }
    
    if invert {
        let n_f = n as f32;
        for i in 0..n {
            re[i] /= n_f;
            im[i] /= n_f;
        }
    }
}

// Core Spectral Autoregressive Prediction: FFT -> pointwise complex Hadamard product -> IFFT -> phase extraction
#[no_mangle]
pub unsafe extern "C" fn spectral_predict() {
    // Local buffers for FFT computation
    let mut re = [0.0f32; D];
    let mut im = [0.0f32; D];
    
    // 1. Transform context angles to complex exponential representation
    for i in 0..D {
        re[i] = cosf(CONTEXT_ANGLES[i]);
        im[i] = sinf(CONTEXT_ANGLES[i]);
    }
    
    // 2. Perform forward FFT
    fft_in_place(&mut re, &mut im, false);
    
    // 3. Compute pointwise complex Hadamard product with transition weights spectrum
    for i in 0..D {
        let t_re = re[i];
        let t_im = im[i];
        re[i] = t_re * TRANSITION_SPEC_RE[i] - t_im * TRANSITION_SPEC_IM[i];
        im[i] = t_re * TRANSITION_SPEC_IM[i] + t_im * TRANSITION_SPEC_RE[i];
    }
    
    // 4. Perform inverse FFT (IFFT)
    fft_in_place(&mut re, &mut im, true);
    
    // 5. Extract reconstructed query phases modulo 2*PI
    for i in 0..D {
        let mut v = atan2f(im[i], re[i]);
        if v < 0.0 {
            v += 2.0 * PI;
        }
        QUERY_ANGLES[i] = v % (2.0 * PI);
    }
}

// Compute phase cosine similarities for the entire vocabulary (Auto-vectorized by LLVM using SIMD)
// Compute phase cosine similarities for the entire vocabulary (Auto-vectorized by LLVM using SIMD)
#[no_mangle]
pub unsafe extern "C" fn compute_similarity(
    vocab_size: i32,
    vocab_cos: *const f32,
    vocab_sin: *const f32,
    scores: *mut f32
) {
    let vocab_size_u = vocab_size as usize;
    
    // Pre-calculate query cos and sin arrays
    let mut query_cos = [0.0f32; D];
    let mut query_sin = [0.0f32; D];
    for i in 0..D {
        query_cos[i] = cosf(QUERY_ANGLES[i]);
        query_sin[i] = sinf(QUERY_ANGLES[i]);
    }
    
    // Loop over vocabulary and calculate cosine similarity
    for v in 0..vocab_size_u {
        let offset = v * D;
        let mut sum = 0.0f32;
        
        let cos_slice = core::slice::from_raw_parts(vocab_cos.add(offset), D);
        let sin_slice = core::slice::from_raw_parts(vocab_sin.add(offset), D);
        
        for i in 0..D {
            sum += query_cos[i] * cos_slice[i] + query_sin[i] * sin_slice[i];
        }
        
        *scores.add(v) = sum / (D as f32);
    }
}

// Ultra high performance: Computes similarity, applies N-gram transition weights, and selects top-5 candidates in a single pass
#[no_mangle]
pub unsafe extern "C" fn compute_similarity_and_select_top_k(
    vocab_size: i32,
    vocab_cos: *const f32,
    vocab_sin: *const f32,
    transition_indices: *const i32,
    transition_multipliers: *const f32,
    num_transitions: i32,
    top_indices: *mut i32,
    top_scores: *mut f32
) {
    let vocab_size_u = vocab_size as usize;
    
    // Pre-calculate query cos and sin arrays
    let mut query_cos = [0.0f32; D];
    let mut query_sin = [0.0f32; D];
    for i in 0..D {
        query_cos[i] = cosf(QUERY_ANGLES[i]);
        query_sin[i] = sinf(QUERY_ANGLES[i]);
    }
    
    let mut top_k_idx = [-1; 5];
    let mut top_k_val = [-1e9f32; 5];
    
    // 1. Calculate similarities and perform linear selection in a single register loop
    for v in 0..vocab_size_u {
        let offset = v * D;
        let mut sum = 0.0f32;
        
        let v_cos_ptr = vocab_cos.add(offset);
        let v_sin_ptr = vocab_sin.add(offset);
        
        let mut i = 0;
        while i < D {
            sum += *query_cos.get_unchecked(i) * *v_cos_ptr.add(i) + *query_sin.get_unchecked(i) * *v_sin_ptr.add(i);
            sum += *query_cos.get_unchecked(i+1) * *v_cos_ptr.add(i+1) + *query_sin.get_unchecked(i+1) * *v_sin_ptr.add(i+1);
            sum += *query_cos.get_unchecked(i+2) * *v_cos_ptr.add(i+2) + *query_sin.get_unchecked(i+2) * *v_sin_ptr.add(i+2);
            sum += *query_cos.get_unchecked(i+3) * *v_cos_ptr.add(i+3) + *query_sin.get_unchecked(i+3) * *v_sin_ptr.add(i+3);
            sum += *query_cos.get_unchecked(i+4) * *v_cos_ptr.add(i+4) + *query_sin.get_unchecked(i+4) * *v_sin_ptr.add(i+4);
            sum += *query_cos.get_unchecked(i+5) * *v_cos_ptr.add(i+5) + *query_sin.get_unchecked(i+5) * *v_sin_ptr.add(i+5);
            sum += *query_cos.get_unchecked(i+6) * *v_cos_ptr.add(i+6) + *query_sin.get_unchecked(i+6) * *v_sin_ptr.add(i+6);
            sum += *query_cos.get_unchecked(i+7) * *v_cos_ptr.add(i+7) + *query_sin.get_unchecked(i+7) * *v_sin_ptr.add(i+7);
            i += 8;
        }
        
        let mut score = sum / (D as f32);
        
        // Probability scaling: score = Math.max(0.0001, (score + 1.0) / 2.0);
        score = (score + 1.0) / 2.0;
        if score < 0.0001 {
            score = 0.0001;
        }
        
        // 2. Apply N-gram transition weights natively
        if num_transitions >= 0 {
            let mut matched = false;
            for t in 0..(num_transitions as usize) {
                if v as i32 == *transition_indices.add(t) {
                    score *= *transition_multipliers.add(t);
                    matched = true;
                    break;
                }
            }
            if !matched {
                if num_transitions > 0 {
                    score *= 0.1;
                } else {
                    score *= 0.5;
                }
            }
        }
        
        // 3. Single-pass linear Top-K selection
        if score > top_k_val[4] {
            top_k_val[4] = score;
            top_k_idx[4] = v as i32;
            
            let mut k = 4;
            while k > 0 && top_k_val[k] > top_k_val[k-1] {
                top_k_val.swap(k, k-1);
                top_k_idx.swap(k, k-1);
                k -= 1;
            }
        }
    }
    
    // 4. Output the top 5 results to Wasm pointers
    for i in 0..5 {
        *top_indices.add(i) = top_k_idx[i];
        *top_scores.add(i) = top_k_val[i];
    }
}



// Ultra high performance: Natively combines two phase representations in complex space (SIMD auto-vectorized)
#[no_mangle]
pub unsafe extern "C" fn combine_phases(
    rep_a: *const f32,
    weight_a: f32,
    rep_b: *const f32,
    weight_b: f32,
    out_rep: *mut f32
) {
    for i in 0..D {
        let re = weight_a * cosf(*rep_a.add(i)) + weight_b * cosf(*rep_b.add(i));
        let im = weight_a * sinf(*rep_a.add(i)) + weight_b * sinf(*rep_b.add(i));
        let mut v = atan2f(im, re);
        if v < 0.0 {
            v += 2.0 * PI;
        }
        *out_rep.add(i) = v % (2.0 * PI);
    }
}

// Zero-copy combination: Combines phases directly reading from precomputed vocab_cos and vocab_sin arrays using word indices
#[no_mangle]
pub unsafe extern "C" fn combine_phases_by_indices(
    prompt_idx: i32,
    weight_a: f32,
    generated_idx: i32,
    weight_b: f32,
    vocab_cos: *const f32,
    vocab_sin: *const f32,
    out_rep: *mut f32
) {
    let offset_a = prompt_idx as usize * D;
    let offset_b = generated_idx as usize * D;
    
    let cos_a = vocab_cos.add(offset_a);
    let sin_a = vocab_sin.add(offset_a);
    let cos_b = vocab_cos.add(offset_b);
    let sin_b = vocab_sin.add(offset_b);
    
    for i in 0..D {
        let re = weight_a * *cos_a.add(i) + weight_b * *cos_b.add(i);
        let im = weight_a * *sin_a.add(i) + weight_b * *sin_b.add(i);
        let mut v = atan2f(im, re);
        if v < 0.0 {
            v += 2.0 * PI;
        }
        *out_rep.add(i) = v % (2.0 * PI);
    }
}

// Zero-copy similarity calculation: Computes similarities only for candidates using precomputed vocab_cos and vocab_sin arrays
#[no_mangle]
pub unsafe extern "C" fn compute_similarity_for_candidates(
    candidate_indices: *const i32,
    num_candidates: i32,
    vocab_cos: *const f32,
    vocab_sin: *const f32,
    transition_indices: *const i32,
    transition_multipliers: *const f32,
    num_transitions: i32,
    top_indices: *mut i32,
    top_scores: *mut f32
) {
    let num_candidates_u = num_candidates as usize;
    
    let mut query_cos = [0.0f32; D];
    let mut query_sin = [0.0f32; D];
    for i in 0..D {
        query_cos[i] = cosf(QUERY_ANGLES[i]);
        query_sin[i] = sinf(QUERY_ANGLES[i]);
    }
    
    let mut top_k_idx = [-1; 5];
    let mut top_k_val = [-1e9f32; 5];
    
    for c in 0..num_candidates_u {
        let v = *candidate_indices.add(c) as usize;
        let offset = v * D;
        let mut sum = 0.0f32;
        
        let v_cos_ptr = vocab_cos.add(offset);
        let v_sin_ptr = vocab_sin.add(offset);
        
        let mut i = 0;
        while i < D {
            sum += *query_cos.get_unchecked(i) * *v_cos_ptr.add(i) + *query_sin.get_unchecked(i) * *v_sin_ptr.add(i);
            sum += *query_cos.get_unchecked(i+1) * *v_cos_ptr.add(i+1) + *query_sin.get_unchecked(i+1) * *v_sin_ptr.add(i+1);
            sum += *query_cos.get_unchecked(i+2) * *v_cos_ptr.add(i+2) + *query_sin.get_unchecked(i+2) * *v_sin_ptr.add(i+2);
            sum += *query_cos.get_unchecked(i+3) * *v_cos_ptr.add(i+3) + *query_sin.get_unchecked(i+3) * *v_sin_ptr.add(i+3);
            sum += *query_cos.get_unchecked(i+4) * *v_cos_ptr.add(i+4) + *query_sin.get_unchecked(i+4) * *v_sin_ptr.add(i+4);
            sum += *query_cos.get_unchecked(i+5) * *v_cos_ptr.add(i+5) + *query_sin.get_unchecked(i+5) * *v_sin_ptr.add(i+5);
            sum += *query_cos.get_unchecked(i+6) * *v_cos_ptr.add(i+6) + *query_sin.get_unchecked(i+6) * *v_sin_ptr.add(i+6);
            sum += *query_cos.get_unchecked(i+7) * *v_cos_ptr.add(i+7) + *query_sin.get_unchecked(i+7) * *v_sin_ptr.add(i+7);
            i += 8;
        }
        
        let mut score = sum / (D as f32);
        score = (score + 1.0) / 2.0;
        if score < 0.0001 {
            score = 0.0001;
        }
        
        if num_transitions >= 0 {
            let mut matched = false;
            for t in 0..(num_transitions as usize) {
                if v as i32 == *transition_indices.add(t) {
                    score *= *transition_multipliers.add(t);
                    matched = true;
                    break;
                }
            }
            if !matched {
                if num_transitions > 0 {
                    score *= 0.1;
                } else {
                    score *= 0.5;
                }
            }
        }
        
        if score > top_k_val[4] {
            top_k_val[4] = score;
            top_k_idx[4] = v as i32;
            
            let mut k = 4;
            while k > 0 && top_k_val[k] > top_k_val[k-1] {
                top_k_val.swap(k, k-1);
                top_k_idx.swap(k, k-1);
                k -= 1;
            }
        }
    }
    
    for i in 0..5 {
        *top_indices.add(i) = top_k_idx[i];
        *top_scores.add(i) = top_k_val[i];
     }
}

#[no_mangle]
pub unsafe extern "C" fn wasm_attention(
    q_ptr: *const f32,
    k_ptr: *const f32,
    v_ptr: *const f32,
    y_ptr: *mut f32,
    l: usize,
    d: usize,
    s_ptr: *mut f32,
) {
    let q = core::slice::from_raw_parts(q_ptr, l * d);
    let k = core::slice::from_raw_parts(k_ptr, l * d);
    let v = core::slice::from_raw_parts(v_ptr, l * d);
    let y = core::slice::from_raw_parts_mut(y_ptr, l * d);
    let s = core::slice::from_raw_parts_mut(s_ptr, l * l);

    let d_sqrt = sqrtf(d as f32);

    // 1. S = Q K^T / sqrt(D)
    for i in 0..l {
        for j in 0..l {
            let mut sum = 0.0;
            for kk in 0..d {
                sum += q[i * d + kk] * k[j * d + kk];
            }
            s[i * l + j] = sum / d_sqrt;
        }
    }

    // 2. Softmax row-wise
    for i in 0..l {
        let mut max = -core::f32::INFINITY;
        for j in 0..l {
            if s[i * l + j] > max {
                max = s[i * l + j];
            }
        }
        let mut sum = 0.0;
        for j in 0..l {
            s[i * l + j] = expf(s[i * l + j] - max);
            sum += s[i * l + j];
        }
        for j in 0..l {
            s[i * l + j] /= sum;
        }
    }

    // 3. Y = S V
    for i in 0..l {
        for j in 0..d {
            let mut sum = 0.0;
            for kk in 0..l {
                sum += s[i * l + kk] * v[kk * d + j];
            }
            y[i * d + j] = sum;
        }
    }
}
