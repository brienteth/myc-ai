import argparse
import sys
import pytest

def main():
    parser = argparse.ArgumentParser(description="Myca Colony Validation & Execution Verification CLI")
    parser.add_argument("command", choices=["test"], help="Command to run")
    parser.add_argument("--offline", action="store_true", help="Run offline mode tests")
    parser.add_argument("--planner", action="store_true", help="Run planner tests")
    parser.add_argument("--distributed", action="store_true", help="Run distributed tests")
    parser.add_argument("--performance", action="store_true", help="Run performance tests")
    parser.add_argument("--recovery", action="store_true", help="Run recovery tests")
    parser.add_argument("--workflow", action="store_true", help="Run workflow tests")
    parser.add_argument("--automation", action="store_true", help="Run automation tests")
    parser.add_argument("--all", action="store_true", help="Run all tests")

    args = parser.parse_args()

    if args.command == "test":
        pytest_args = ["-v", "--tb=short"]

        if args.offline:
            pytest_args.append("tests/offline/")
        elif args.planner:
            pytest_args.append("tests/planner/")
        elif args.distributed:
            pytest_args.append("tests/colony/")
        elif args.performance:
            pytest_args.append("tests/performance/")
        elif args.recovery:
            pytest_args.append("tests/recovery/")
        elif args.workflow or args.automation:
            pytest_args.append("tests/integration/")
        elif args.all:
            pytest_args.append("tests/")
        else:
            # Default fallback if no specific suite is selected but 'test' is run
            pytest_args.append("tests/")

        print(f"Running pytest with args: {pytest_args}")
        sys.exit(pytest.main(pytest_args))

if __name__ == "__main__":
    main()
