import os
import shutil

src_network = '/Users/bl10buer/Desktop/myc-network'
target_repo = '/Users/bl10buer/Desktop/myca-private-main'

print("=== STARTING PROFESSIONAL REPOSITORY RESTRUCTURING ===")

# 1. Ensure all root HTML and asset files are backed up in public/
pub_dir = os.path.join(target_repo, 'public')
os.makedirs(pub_dir, exist_ok=True)

root_html_files = [f for f in os.listdir(target_repo) if f.endswith('.html')]
print(f"Found {len(root_html_files)} root HTML files to clean up...")

for h in root_html_files:
    src_h = os.path.join(target_repo, h)
    dst_h = os.path.join(pub_dir, h)
    if not os.path.exists(dst_h):
        shutil.copy2(src_h, dst_h)
        print(f"Backed up {h} to public/")
    os.remove(src_h)
    print(f"Removed loose root HTML: {h}")

# Remove loose root assets (ensure they are in public/)
root_assets = [
    'brand.css', 'i18n.js', 'manifest.json', 'hero.png', 'icon.png', 
    'icon.svg', 'icons.svg', 'favicon.svg', 'logo.png', 'myca_logo.svg', 
    'mycai_logo.png', 'myca_c99_kernel_infographic.jpg', 
    'myca_resonance_asset_x.jpg', 'myca_resonance_asset_x.png'
]

for a in root_assets:
    src_a = os.path.join(target_repo, a)
    dst_a = os.path.join(pub_dir, a)
    if os.path.exists(src_a):
        if not os.path.exists(dst_a):
            shutil.copy2(src_a, dst_a)
            print(f"Backed up {a} to public/")
        os.remove(src_a)
        print(f"Removed loose root asset: {a}")

# 2. Remove scratch/ garbage (51MB) and temporary caches
for junk in ['scratch', '.pytest_cache', '.vercel.bak']:
    junk_path = os.path.join(target_repo, junk)
    if os.path.exists(junk_path):
        shutil.rmtree(junk_path, ignore_errors=True)
        print(f"Removed junk directory: {junk}")

# 3. Create Sui-style apps/ directory
apps_web = os.path.join(target_repo, 'apps', 'web')
os.makedirs(apps_web, exist_ok=True)
# Copy web source into apps/web for institutional monorepo clarity
for item in os.listdir(pub_dir):
    s = os.path.join(pub_dir, item)
    d = os.path.join(apps_web, item)
    if os.path.isdir(s):
        if not os.path.exists(d):
            shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)
print("Populated apps/web with frontend portal sources.")

# 4. Sync blockchain core directories from myc-network to target_repo root
blockchain_dirs = [
    'core', 'ledger', 'mesh', 'depin', 'contracts', 'rpc', 
    'edge-rpc', 'sdk', 'bin', 'cli', 'tests', 'test', 
    'colony', 'ai', 'agent-core', 'simulator', 'scripts'
]

for b_dir in blockchain_dirs:
    s = os.path.join(src_network, b_dir)
    d = os.path.join(target_repo, b_dir)
    if os.path.exists(s):
        if os.path.exists(d):
            shutil.rmtree(d, ignore_errors=True)
        shutil.copytree(s, d)
        print(f"Synchronized blockchain subsystem: {b_dir}/")

# Copy server.js and package.json from myc-network
for f in ['server.js', 'package.json']:
    s = os.path.join(src_network, f)
    d = os.path.join(target_repo, f)
    if os.path.exists(s):
        shutil.copy2(s, d)
        print(f"Synchronized root runtime file: {f}")

# Remove redundant packages/network if it exists to prevent duplication
pkg_network = os.path.join(target_repo, 'packages', 'network')
if os.path.exists(pkg_network):
    shutil.rmtree(pkg_network, ignore_errors=True)
    print("Removed obsolete nested packages/network/ directory.")

# 5. Update .gitignore
gitignore_path = os.path.join(target_repo, '.gitignore')
gitignore_content = '''# Dependencies
node_modules/
.pnp
.pnp.js

# Environment and Local Secrets
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel & Cloud
.vercel
.vercel.bak

# Build Artifacts & Binaries
dist/
build/
*.dylib
*.so
*.dll
*.bin
*.out
*.exe
core/kernel/c99_stress_bin
core/kernel/test_ram_bin
core/kernel/bench_real

# Temporary & Scratch
scratch/
tmp/
temp/
.DS_Store
Thumbs.db
.pytest_cache/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Database local storage
data/*.db
data/*.sqlite
'''

with open(gitignore_path, 'w', encoding='utf-8') as f:
    f.write(gitignore_content)
print("Updated .gitignore with strict security & cleanliness rules.")

print("=== RESTRUCTURING STEP COMPLETED SUCCESSFULLY ===")
