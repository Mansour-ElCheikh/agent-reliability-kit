---
name: big
description: A deliberately oversized skill fixture used to exercise R26_skill_size_warn. The fixture governance.yaml sets warn_bytes to 200 and max_bytes to 500 so this file lands in the warn band, proving the prompt_size_warn predicate fires a warn (not an error) between the soft and hard caps.
---

# Big

This body pushes the file past 200 bytes so R26 warns.
