# Open Source Licenses

GoOn ReDdIt bundles and depends on several open source projects. Below are their licenses.

---

## npm Dependencies

All of the following are licensed under the **MIT License** unless otherwise noted.

| Package | License |
|---------|---------|
| react | MIT |
| react-dom | MIT |
| electron | MIT |
| tailwindcss | MIT |
| vitest | MIT |
| electron-builder | MIT |
| electron-vite | MIT |
| @types/node | MIT |
| @types/react | MIT |
| @types/react-dom | MIT |

### TypeScript 7.0.2

Apache License, Version 2.0

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to the copyright owner by the original author, or by an
      agent or entity authorized to submit on behalf of the original author.
      The foregoing includes translations and derivative works covered
      by this License.

      "Contributor" shall mean any person or entity that submits a
      Contribution to the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works under the terms of this License.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, this copyright notice, the above
          copyright notice, and this License notice (or add them to
          the source of any other files distributed by You); and

      (d) You must give attribution to the original authors and
          contributors.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Contributor shall be under the terms and conditions
      of this License, without any additional terms or conditions.
      No-charge, royalty-free, irrevocable copyright license, patent
      license, or other intellectual property rights license granted
      by a Contributor.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing
      the origin of the Work and reproducing the content of any accompanying
      NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, except as required by applicable law.

   END OF TERMS AND CONDITIONS
```

---

## Bundled Tools

### FFmpeg

Licensed under the **GNU Lesser General Public License, version 2.1** (or at your option, any later version).

FFmpeg is dynamically linked at runtime. The LGPL requires that you provide the ability to relink against a modified version of FFmpeg. This is satisfied by shipping the full FFmpeg binaries in the `tools/` directory alongside the app.

- Website: https://ffmpeg.org
- License: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html

### yt-dlp

Licensed under the **Unlicense** — this means the software is in the public domain. No license restrictions apply.

- Repository: https://github.com/yt-dlp/yt-dlp
- License: https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE

---

## Electron

Electron is licensed under the **MIT License**.

Electron bundles Chromium and Node.js, both of which carry their own licenses (BSD-style for Chromium, MIT for Node.js). These are included as part of the Electron distribution.

- Repository: https://github.com/electron/electron
- License: https://github.com/electron/electron/blob/main/LICENSE

---

## Summary

| License | Count |
|---------|-------|
| MIT | 10 packages |
| Apache-2.0 | 1 package (TypeScript) |
| LGPL-2.1 | 1 tool (FFmpeg) |
| Unlicense | 1 tool (yt-dlp) |
