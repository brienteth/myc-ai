"""
Execution Studio Planner & Compiler Regression Test Suite
Enforces intent routing correctness for prompts A through I without breaking existing E2E workflows.
"""
import pytest
from myca_intelligence.automation.planner import ExecutionContractPlanner
from myca.contracts.execution import ExecutionContractCompiler
from myca.registry import DeviceCapabilityRegistry


@pytest.mark.anyio
async def test_execution_studio_intent_regression_matrix():
    """Verify correct intent routing and contract properties for all golden paths A through I."""
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    planner = ExecutionContractPlanner(inference_engine=None)
    compiler = ExecutionContractCompiler(registry)

    # Prompt sets A through I matching the requested test scenarios
    regression_matrix = [
        # A. Direct Chat
        {
            "prompt": "Merhaba nasılsın?",
            "expected_intent": "CHAT",
            "required_verifier": False
        },
        # B. PDF Scanning / File Operation
        {
            "prompt": "Bu PDF'i özetle ve önemli rakamları çıkar.",
            "expected_intent": "FILE_OPERATION",
            "required_verifier": True
        },
        # C. Multi-Source Research
        {
            "prompt": "3 farklı kaynaktan Bitcoin hakkında araştırma yap ve rapor hazırla.",
            "expected_intent": "RESEARCH_SYNTHESIS",
            "required_verifier": True
        },
        # D. Messaging / Telegram Automation
        {
            "prompt": "Telegram'dan Ahmet'e yarınki toplantıyı hatırlat.",
            "expected_intent": "COMMUNICATION_AUTOMATION",
            "required_verifier": True
        },
        # E. Filesystem Batch
        {
            "prompt": "Bilgisayarımdaki son 20 PDF'i analiz et ve finansla ilgili olanları bul.",
            "expected_intent": "DATA_ANALYSIS",
            "required_verifier": True
        },
        # F. Cross-Device Colony Mesh
        {
            "prompt": "Telefonumdaki kamerayla bu belgeyi çek, Mac'te analiz et, önemli bilgileri çıkar, rapor oluştur ve hafızama kaydet.",
            "expected_intent": "CROSS_DEVICE_COLONY",
            "required_verifier": True
        },
        # G. CSV Processing (Code Execution with Repair Loop)
        {
            "prompt": "Python ile bir CSV dosyasını okuyup boş satırları temizleyen, duplicate kayıtları kaldıran ve sonucu yeni bir CSV dosyasına kaydeden script oluştur. Kodu üret, çalıştır, çıktıyı doğrula ve hata varsa düzelt.",
            "expected_intent": "CODE_EXECUTION",
            "required_verifier": True
        },
        # H. Web Scraping
        {
            "prompt": "Bu web sitesinden fiyat verilerini çek ve scraped_data.json olarak kaydet.",
            "expected_intent": "WEB_SCRAPING",
            "required_verifier": True
        },
        # I. Code Generation (Pure drafting without execution)
        {
            "prompt": "Bize clean-code standartlarında, input parametresi olarak sayi alan ve asal sayı olup olmadığını dönen bir javascript fonksiyonu yaz.",
            "expected_intent": "CODE_GENERATION",
            "required_verifier": True
        }
    ]

    for case in regression_matrix:
        prompt = case["prompt"]
        expected = case["expected_intent"]
        
        # 1. Test against ExecutionContractPlanner (Automation Planner)
        contract = await planner.plan_intent(prompt)
        assert contract["intent"] == expected, f"Planner misrouted prompt '{prompt}': got {contract['intent']}, expected {expected}"
        planner_verification = contract.get("verification", {}).get("required", False)
        assert planner_verification == case["required_verifier"], f"Verification required mismatch for '{prompt}': got {planner_verification}"

        # 2. Test against ExecutionContractCompiler (OS Compiler)
        os_contract = compiler.compile(prompt)
        assert os_contract.intent == expected, f"OS Compiler misrouted prompt '{prompt}': got {os_contract.intent}, expected {expected}"
        
        # Verify node count matches capabilities
        assert len(os_contract.nodes) > 0
        assert len(os_contract.device_assignments) == len(os_contract.nodes)
