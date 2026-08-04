import argparse
import asyncio
import sys
import pytest

def main():
    parser = argparse.ArgumentParser(description="Myca Colony Validation & Execution Verification CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ── Test Command ──────────────────────────────────────────
    test_parser = subparsers.add_parser("test", help="Run tests")
    test_parser.add_argument("--offline", action="store_true", help="Run offline mode tests")
    test_parser.add_argument("--planner", action="store_true", help="Run planner tests")
    test_parser.add_argument("--distributed", action="store_true", help="Run distributed tests")
    test_parser.add_argument("--performance", action="store_true", help="Run performance tests")
    test_parser.add_argument("--recovery", action="store_true", help="Run recovery tests")
    test_parser.add_argument("--workflow", action="store_true", help="Run workflow tests")
    test_parser.add_argument("--automation", action="store_true", help="Run automation tests")
    test_parser.add_argument("--factory", action="store_true", help="Run factory tests")
    test_parser.add_argument("--crawler", action="store_true", help="Run crawler tests")
    test_parser.add_argument("--brain", action="store_true", help="Run brain/vault tests")
    test_parser.add_argument("--sdk", action="store_true", help="Run SDK tests")
    test_parser.add_argument("--all", action="store_true", help="Run all tests")

    # ── Factory Commands (Finn-loop) ──────────────────────────
    factory_parser = subparsers.add_parser("factory", help="Software Factory (Spec → Build → Review)")
    factory_sub = factory_parser.add_subparsers(dest="factory_cmd")

    spec_parser = factory_sub.add_parser("spec", help="Create a new spec from a description")
    spec_parser.add_argument("prompt", type=str, help="Description of what to build")
    spec_parser.add_argument("--repo", type=str, default=None, help="Path to git repository")

    build_parser = factory_sub.add_parser("build", help="Build an AGENT_READY spec")
    build_parser.add_argument("spec_id", type=str, help="Spec ID to build")

    review_parser = factory_sub.add_parser("review", help="Review a built spec")
    review_parser.add_argument("spec_id", type=str, help="Spec ID to review")

    loop_parser = factory_sub.add_parser("loop", help="Run autonomous factory loop")
    loop_parser.add_argument("--repo", type=str, default=None, help="Path to git repository")

    list_parser = factory_sub.add_parser("list", help="List specs")
    list_parser.add_argument("--status", type=str, default=None, help="Filter by status")

    approve_parser = factory_sub.add_parser("approve", help="Mark a spec as AGENT_READY")
    approve_parser.add_argument("spec_id", type=str, help="Spec ID to approve")

    # ── Scrape Command (Firecrawl) ────────────────────────────
    scrape_parser = subparsers.add_parser("scrape", help="Scrape a URL to clean Markdown")
    scrape_parser.add_argument("url", type=str, help="URL to scrape")
    scrape_parser.add_argument("--raw", action="store_true", help="Include full HTML content")
    scrape_parser.add_argument("--json", action="store_true", dest="as_json", help="Output as JSON")

    # ── Handover / Resume Commands (Brain) ────────────────────
    handover_parser = subparsers.add_parser("handover", help="Save session context")
    handover_parser.add_argument("summary", type=str, help="Session summary")
    handover_parser.add_argument("--decisions", nargs="*", help="Key decisions made")
    handover_parser.add_argument("--next-steps", nargs="*", help="Next steps")
    handover_parser.add_argument("--questions", nargs="*", help="Open questions")

    resume_parser = subparsers.add_parser("resume", help="Resume from last handover")
    resume_parser.add_argument("--id", type=str, default=None, help="Specific handover ID")

    # ── Parse & Execute ──────────────────────────────────────
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

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
        elif args.factory:
            pytest_args.append("tests/test_factory.py")
        elif args.crawler:
            pytest_args.append("tests/test_crawler.py")
        elif args.brain:
            pytest_args.append("tests/test_brain.py")
        elif args.sdk:
            pytest_args.append("tests/test_sdk.py")
        elif args.all:
            pytest_args.append("tests/")
        else:
            # Default fallback if no specific suite is selected but 'test' is run
            pytest_args.append("tests/")

        print(f"Running pytest with args: {pytest_args}")
        sys.exit(pytest.main(pytest_args))

    elif args.command == "factory":
        asyncio.run(_run_factory(args))

    elif args.command == "scrape":
        asyncio.run(_run_scrape(args))

    elif args.command == "handover":
        asyncio.run(_run_handover(args))

    elif args.command == "resume":
        asyncio.run(_run_resume(args))


# ── Async CLI Runners ─────────────────────────────────────────

async def _run_factory(args):
    from myca.automation.factory import SoftwareFactoryEngine, FactoryDB
    import json

    engine = SoftwareFactoryEngine()

    if args.factory_cmd == "spec":
        spec = await engine.spec_interview(args.prompt, args.repo)
        print(f"\n✅ Spec created: {spec['id']}")
        print(f"   Title: {spec['title']}")
        print(f"   Status: {spec['status']}")
        print(f"   Acceptance Criteria:")
        for ac in spec.get("acceptance_criteria", []):
            print(f"     • {ac}")
        if spec.get("non_goals"):
            print(f"   Non-Goals:")
            for ng in spec["non_goals"]:
                print(f"     • {ng}")
        print(f"\n💡 To approve: myca factory approve {spec['id']}")

    elif args.factory_cmd == "build":
        result = await engine.build_spec(args.spec_id)
        print(f"\n🔨 Build started: {result['id']}")
        print(f"   Branch: {result.get('branch_name', 'N/A')}")
        print(f"   Status: {result['status']}")

    elif args.factory_cmd == "review":
        review = await engine.review_build(args.spec_id)
        verdict = review["verdict"]
        icon = {"LOOP_APPROVED": "✅", "LOOP_CHANGES_REQUESTED": "🔄", "NEEDS_HUMAN_REVIEW": "👀"}.get(verdict, "❓")
        print(f"\n{icon} Review verdict: {verdict}")
        findings = review.get("findings", {})
        if findings.get("must_fix"):
            print("   Must Fix:")
            for f in findings["must_fix"]:
                print(f"     ❌ {f}")
        if findings.get("suggestions"):
            print("   Suggestions:")
            for s in findings["suggestions"]:
                print(f"     💡 {s}")
        if findings.get("praise"):
            print("   Praise:")
            for p in findings["praise"]:
                print(f"     🌟 {p}")

    elif args.factory_cmd == "loop":
        result = await engine.run_loop(repo_path=args.repo)
        print(f"\n🔄 Loop result: {result.get('status', 'unknown')}")
        if result.get("verdict"):
            print(f"   Verdict: {result['verdict']}")
        if result.get("message"):
            print(f"   Message: {result['message']}")

    elif args.factory_cmd == "list":
        specs = FactoryDB.list_specs(status=args.status)
        if not specs:
            print("\n📋 No specs found.")
        else:
            print(f"\n📋 Factory Specs ({len(specs)} total):")
            for s in specs:
                icon = {"DRAFT": "📝", "SPECIFIED": "📋", "AGENT_READY": "🟢", "IN_PROGRESS": "🔨",
                        "APPROVED": "✅", "BLOCKED": "🔴", "NEEDS_HUMAN_REVIEW": "👀", "MERGED": "🎉"}.get(s["status"], "❓")
                print(f"   {icon} [{s['status']}] {s['id']} — {s['title']}")

    elif args.factory_cmd == "approve":
        FactoryDB.update_spec_status(args.spec_id, "AGENT_READY")
        print(f"\n🟢 Spec {args.spec_id} marked as AGENT_READY")
        print(f"   Run 'myca factory loop' or 'myca factory build {args.spec_id}' to begin.")

    else:
        print("Usage: myca factory {spec|build|review|loop|list|approve}")


async def _run_scrape(args):
    from myca.automation.crawler import LocalWebCrawler
    import json

    crawler = LocalWebCrawler()
    result = await crawler.scrape_url(args.url, only_main_content=not args.raw)

    if args.as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"\n📄 {result['title']}")
        print(f"   URL: {result['url']}")
        print(f"   Words: {result['word_count']}")
        print(f"\n{'─' * 60}\n")
        print(result["markdown"])


async def _run_handover(args):
    from myca.automation.brain import SecondBrainVault

    vault = SecondBrainVault()
    handover = await vault.create_handover(
        summary=args.summary,
        decisions=args.decisions or [],
        next_steps=args.next_steps or [],
        open_questions=args.questions or []
    )
    print(f"\n💾 Handover saved: {handover['id']}")
    print(f"   Summary: {handover['summary'][:80]}")
    if handover.get("next_steps"):
        print(f"   Next Steps:")
        for s in handover["next_steps"]:
            print(f"     • {s}")
    print(f"\n💡 To resume: myca resume")


async def _run_resume(args):
    from myca.automation.brain import SecondBrainVault

    vault = SecondBrainVault()
    handover = await vault.load_handover(args.id)

    if not handover:
        print("\n📭 No handover sessions found. Create one with: myca handover \"your summary\"")
        return

    print(f"\n🔄 Resuming from: {handover['id']}")
    print(f"   Summary: {handover['summary']}")
    if handover.get("decisions"):
        print(f"   Decisions:")
        for d in handover["decisions"]:
            print(f"     ✓ {d}")
    if handover.get("next_steps"):
        print(f"   Next Steps:")
        for s in handover["next_steps"]:
            print(f"     ☐ {s}")
    if handover.get("open_questions"):
        print(f"   Open Questions:")
        for q in handover["open_questions"]:
            print(f"     ❓ {q}")


if __name__ == "__main__":
    main()
