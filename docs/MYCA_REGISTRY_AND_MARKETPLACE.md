# Myca Registry vs. Marketplace Specification

> **Architecture Separation:**
> - **Registry**: Low-level storage, signature verification, checksum validation, CLI API (`registry.myca.ai`).
> - **Marketplace**: High-level UI discovery, ratings, reviews, curated collections (`marketplace.myca.ai`).

---

## 1. Registry Architecture (`registry.myca.ai`)

The **Registry** is the protocol endpoint for `myca-pm` CLI operations.

```text
CLI (myca install office)
          │
          ▼
   Registry Service
          │
          ├─► Fetch Package Manifest
          ├─► Verify Ed25519 Cryptographic Signature
          ├─► Resolve Skill Dependencies
          ├─► Checksum SHA-256 Validation
          └─► Stream Package Tarball (.myca-pkg)
```

### CLI API Endpoints
- `GET /v1/packages/:id`
- `GET /v1/packages/:id/download`
- `POST /v1/packages/publish`
- `GET /v1/search?q=query`

---

## 2. Marketplace Architecture (`marketplace.myca.ai`)

The **Marketplace** is the visual discovery UI for end-users:

```text
Web / Desktop App (Marketplace View)
          │
          ▼
    Marketplace UI
          │
          ├─► Curated Official Skill Packs
          ├─► Community Ratings & Reviews
          ├─► Verified Badges & Energy Grades
          ├─► One-Click Install to Local Engine
          └─► Developer Analytics & Downloads
```

---

## 3. Product Roadmap Lock

### Phase 1: Core Engine (DONE)
- ✅ Execution Engine & AST
- ✅ Multi-Stage Compiler & Execution IR
- ✅ Multi-Strategy Optimizer & Graph Validator
- ✅ DAG Scheduler & Execution Bus
- ✅ Decoupled Skill ABI & Adapters
- ✅ First-Class Artifact Subsystem
- ✅ Package Standard v2.0 & Package Manager (`myca-pm`)

### Phase 2: Ecosystem & DX
- ⬜ Myca Package Registry (`registry.myca.ai`)
- ⬜ Marketplace UI
- ⬜ Developer DX Scaffolding (`myca create package`)
- ⬜ Official Primitive Skill Packs (Office, Vision, Terminal, Git, Communication)

### Phase 3: Product Verification & Demos
- ⬜ Local-First Offline PDF Intelligence Demo (Zero internet, 20 PDFs)
- ⬜ Natural Language Workflow Studio DAG Generation
- ⬜ 15-Minute 3rd-Party Skill Package Scaffolding & `myca install` Proof
