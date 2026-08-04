import json

class ResultReporter:
    """
    Compiles testing results into HTML, JSON, and Markdown formats.
    """
    def __init__(self, metrics_collector):
        self.metrics = metrics_collector

    def generate_json(self, path: str):
        with open(path, 'w') as f:
            json.dump(self.metrics.metrics, f, indent=2)

    def generate_markdown(self, path: str):
        with open(path, 'w') as f:
            f.write("# Myca Execution Report\n\n")
            f.write(f"- Success Rate: {self.metrics.metrics['success_rate']}%\n")
