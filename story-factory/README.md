# Merlin's Story Factory — Hickory Hollow Seasons One and Two

Working notes and tooling for producing 60 new Hickory Hollow bedtime
manuscripts (HH-S01-001…030, HH-S02-001…030) under the founder's Master
Operating Prompt of 17 November 2026. This folder is not part of the website
build. It exists so that a later session can resume production exactly where
the last one stopped.

**Status (17 Nov 2026): prepared, waiting for the founder's story-title list.
No manuscripts have been written.**

## Authorities (read in this order)

| Source                                               | Drive ID                                       | Governs                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Master Team Roster v1.1 (17 Nov 2026)                | `1Sy9IZYJOAkSclnaZRyVKWqsG4UA_9jTXH9379-wPvSk` | The 19 roles and the 13-stage sequence                                                     |
| Franchise Bible v1.1 (incl. 17 Nov amendments)       | `1sqHBO6DI-2EPJV8uBN8BEpRssMZZ1wcSSfMr7czwmOs` | The eleven-character cast and identities                                                   |
| Franchise Bible v1.0 (`.txt`, 188,025 chars)         | `12KGLthrLbXgWdPVZdkq_R2BDzj_O99jV`            | World, geography, philosophy, festivals, Mountain Wisdom, prohibitions (unless superseded) |
| Character Canon Addendum (15 Nov)                    | `17yLiS0l_lvSQNeBAPZEbGE8ZZ1trU6j3f-sjcAs7SYQ` | Historical; Hattie/Wyatt/skunk Sadie Belle entries superseded by v1.1                      |
| Founder Master Operating Prompt (17 Nov, in session) | —                                              | Process, Triple-Lock, file locations; overrides older text                                 |

Later explicit founder decisions override everything above.

## Drive locations (account stuart@moraltree.media)

| Purpose                    | Season One                          | Season Two                          |
| -------------------------- | ----------------------------------- | ----------------------------------- |
| New manuscripts            | `13PAL5jy1oWvuYHHveIBNjTvkV4-msBkD` | `1ix7SuxmbWQg7zotx3t18w-rMNhutJhi5` |
| QA and publication records | `1Lx5Q5kh0CDWtFBbpi-GpgAwSh2WKr-SW` | `1CM2Gj6uZvUtLMGHtiou0vMYK7-cSurgV` |
| Archive (read-only for us) | `1R0FsJAxWqvMBqZAB1VTCzgLtYExsVaXX` | `1kfybgbHNBbtW-JtE3-2GFeuOvBUnxIHb` |
| New production register    | `1NVGlXKm5ZaWdLsXZbBsmUzzP_LWhQPAX` | `1XnjGo14ez_iMhoOrUjbupKfcjmCrtXTN` |

Never delete, overwrite, revise or restore anything in the archives, in
`Season One — Original Manuscripts Archive`, or in either `06 Awaiting
Deletion` folder. The earlier registers (`HH-S01 Production & QA Register`,
`HH-S02 … v1.2`) are historical and stay as they are.

## Per-story workflow

1. **Concept (Edison → Moneypenny → Merlin).** Premise, cast roles, moral,
   secondary theme, season/setting, ten-chapter outline. Check against v1.1
   cast and the v1.0 prohibitions. Status `CONCEPT READY`.
2. **Draft (Roald Dahl).** Write `HH-S0x-0nn.txt` in the source format
   described in `hh_factory.py`. Target 5,300–5,700 narrated words.
   Status `DRAFT IN PROGRESS`.
3. **Structure gate.** `python3 hh_factory.py count HH-S0x-0nn.txt`. It must
   print `STRUCTURE PASS`.
4. **Lock One (Piers).** Run as a separate review pass, in a fresh subagent
   context where available. Score out of ten with specific findings. Below
   8.5 → Mira revises → Piers reassesses.
5. **Lock Two (Moneypenny + Sherlock).** Canon and continuity checklist plus
   fact checks. Lock Three (Dr Noura) covers safeguarding, bedtime suitability
   and narration readiness. Any substantive revision triggers re-runs of all
   affected locks.
6. **Build and freeze.**
   `python3 hh_factory.py build SRC.txt "HH-S0x-0nn — <Title> — Manuscript v1.0.docx" --ref HH-S0x-0nn --title "<Title>" --created "<date>"`,
   then `freeze` to get the SHA-256 of the narrated text and of the file.
7. **Upload.** Use Drive `create_file` with `disableConversionToGoogleType:
true` into the season's manuscripts folder.
8. **Verify.** Download the file back, check that its `sha256sum` equals the
   frozen file hash, and re-run `count` on the download.
9. **Record.** Fill the register row and set status
   `TRIPLE-LOCK PASS — AWAITING FOUNDER APPROVAL`. Never set `FOUNDER
APPROVED` without Stuart's explicit decision.
10. **Batch checkpoint.** After every batch of five, add a row to the
    register's "Batch checkpoints" sheet. Report it, then continue or stop as
    instructed.

## Honesty rules for the record

- The role reviews are assessments by a single AI system, run as separate
  passes. They are not independent human reviews, and Dr Noura's notes are
  not clinical advice. Every QA record says so.
- Word counts, chapter counts and checksums come from `hh_factory.py`, never
  from estimates.
- A file counts as "uploaded" only once the download-back hash matches.

## Verified on 17 Nov 2026

- Every source above was read in full (Bible v1.0 in five chunks).
- The Drive connector can list, read and create files in the QA folders.
  Both registers were uploaded as native `.xlsx`. The S01 register was
  downloaded back and its SHA-256 matched
  (`bbb7cdd1…cf92ba`). The S02 register's size matched exactly
  (10,373 bytes).
- Both manuscript folders report `canAddChildren: true`. To keep them clean,
  no test file was written there. The first real manuscript upload is the
  first live test of those two folders.
- `hh_factory.py` was self-tested: it rejects 9 chapters and it rejects 6,050
  words; it passes 10 chapters at 5,500 words. A built `.docx` re-counts
  identically.
