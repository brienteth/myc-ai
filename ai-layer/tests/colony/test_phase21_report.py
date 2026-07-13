import pytest
import os
from myca.testing.metrics import MetricsCollector
from myca.testing.reporter import ResultReporter

def test_report_generation():
    """
    REPORT GENERATION VALIDATION
    Verifies the test suite can compile results into a Markdown report.
    """
    metrics = MetricsCollector()
    # Mock some data
    metrics.metrics = {
        "success_rate": 100.0,
        "total_runs": 20,
        "failed_runs": 0
    }
    
    reporter = ResultReporter(metrics)
    report_path = "test_report.md"
    
    try:
        reporter.generate_markdown(report_path)
        assert os.path.exists(report_path)
        
        with open(report_path, "r") as f:
            content = f.read()
            assert "Myca Execution Report" in content
            assert "Success Rate: 100.0%" in content
    finally:
        if os.path.exists(report_path):
            os.remove(report_path)
