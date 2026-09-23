'use strict';
/* =====================================================================
   Trim & Door Takeoff — skirting, architrave and door takeoff from PDF plans
   Single-file app. Coordinates for everything drawn on a sheet are stored in
   "base" units: the pdf.js viewport at scale 1 (PDF points, top-left origin).
   ===================================================================== */
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const SAMPLE_PDF_B64 = 'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAxMTkwLjU1IDg0MS44OV0gL0NvbnRlbnRzIDQgMCBSIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDUgMCBSIC9GMiA2IDAgUiA+PiA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDkyMTEgPj4Kc3RyZWFtCjAuMDAgRwo2LjAwIHcKMTcwLjAwIDE1MC4wMCAzOTYuODUgMjU1LjEyIHJlClMKMC4xNSBHCjIuMDAgdwozMzQuNDEgMTUwLjAwIG0KMzM0LjQxIDQwNS4xMiBsClMKMi4wMCB3CjM5Ni43NyAxNTAuMDAgbQozOTYuNzcgMjYzLjM5IGwKUwoyLjAwIHcKNDk4LjgyIDE1MC4wMCBtCjQ5OC44MiAyNjMuMzkgbApTCjIuMDAgdwozMzQuNDEgMjYzLjM5IG0KNTY2Ljg1IDI2My4zOSBsClMKMi4wMCB3CjQ2NC44MCAyNjMuMzkgbQo0NjQuODAgNDA1LjEyIGwKUwoyLjAwIHcKNDY0LjgwIDM0OC40MyBtCjU2Ni44NSAzNDguNDMgbApTCjIuMDAgdwo0OTguODIgMjEyLjM2IG0KNTY2Ljg1IDIxMi4zNiBsClMKMi4wMCB3CjE3MC4wMCAzMjAuMDggbQozMzQuNDEgMzIwLjA4IGwKUwoyLjAwIHcKMjM4LjAzIDMyMC4wOCBtCjIzOC4wMyA0MDUuMTIgbApTCkJUIC9GMiAxMCBUZiAyMzUuNDAgMjM4LjA0IFRkIChHQVJBR0UpIFRqIEVUCkJUIC9GMSA4IFRmIDIyOC44MCAyMjYuMDQgVGQgKDUuOCB4IDYuMCkgVGogRVQKQlQgL0YyIDEwIFRmIDM1MS41OSAyMDkuNjkgVGQgKEVOVFJZKSBUaiBFVApCVCAvRjEgOCBUZiAzNDIuMTkgMTk3LjY5IFRkICgyLjIgeCA0LjApIFRqIEVUCkJUIC9GMiAxMCBUZiA0MzMuODAgMjA5LjY5IFRkIChCRUQgMSkgVGogRVQKQlQgL0YxIDggVGYgNDI0LjQwIDE5Ny42OSBUZCAoMy42IHggNC4wKSBUaiBFVApCVCAvRjIgMTAgVGYgNTI0LjQzIDE4NC4xOCBUZCAoRU5TKSBUaiBFVApCVCAvRjEgOCBUZiA1MDkuNDMgMTcyLjE4IFRkICgyLjQgeCAyLjIpIFRqIEVUCkJUIC9GMiAxMCBUZiA1MjQuNDMgMjQwLjg3IFRkIChXSVIpIFRqIEVUCkJUIC9GMSA4IFRmIDUwOS40MyAyMjguODcgVGQgKDIuNCB4IDEuOCkgVGogRVQKQlQgL0YyIDEwIFRmIDM4Mi44MSAzMzcuMjUgVGQgKExJVklORykgVGogRVQKQlQgL0YxIDggVGYgMzc2LjIxIDMyNS4yNSBUZCAoNC42IHggNS4wKSBUaiBFVApCVCAvRjIgMTAgVGYgNDk2LjIzIDMwOC45MSBUZCAoS0lUQ0hFTikgVGogRVQKQlQgL0YxIDggVGYgNDkyLjQzIDI5Ni45MSBUZCAoMy42IHggMy4wKSBUaiBFVApCVCAvRjIgMTAgVGYgNTAxLjgzIDM3OS43NyBUZCAoTUVBTFMpIFRqIEVUCkJUIC9GMSA4IFRmIDQ5Mi40MyAzNjcuNzcgVGQgKDMuNiB4IDIuMCkgVGogRVQKQlQgL0YyIDEwIFRmIDE4NC40MiAzNjUuNjAgVGQgKExBVU5EUlkpIFRqIEVUCkJUIC9GMSA4IFRmIDE4MC42MiAzNTMuNjAgVGQgKDIuNCB4IDMuMCkgVGogRVQKQlQgL0YyIDEwIFRmIDI3Mi4yMiAzNjUuNjAgVGQgKEJFRCAyKSBUaiBFVApCVCAvRjEgOCBUZiAyNjIuODIgMzUzLjYwIFRkICgzLjQgeCAzLjApIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzUyLjU1IDE1MC4wMCBtCjM3OC42MyAxNTAuMDAgbApTClEKMC4yMCBHCjEuMjAgdwozNTIuNTUgMTUwLjAwIG0KMzUyLjU1IDE3Ni4wOCBsClMKMzUyLjU1IDE3Ni4wOCBtIDM2Ni45NSAxNzYuMDggMzc4LjYzIDE2NC40MCAzNzguNjMgMTUwLjAwIGMgUwpCVCAvRjEgNyBUZiAzNTcuNTkgMTM2LjAwIFRkIChEMDEpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzM0LjQxIDE5NS4wNyBtCjMzNC40MSAyMTguMzEgbApTClEKMC4yMCBHCjEuMjAgdwozMzQuNDEgMTk1LjA3IG0KMzU3LjY1IDE5NS4wNyBsClMKMzU3LjY1IDE5NS4wNyBtIDM1Ny42NSAyMDcuOTEgMzQ3LjI1IDIxOC4zMSAzMzQuNDEgMjE4LjMxIGMgUwpCVCAvRjEgNyBUZiAzMzguNDEgMjIxLjMxIFRkIChEMDIpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzk2Ljc3IDE5NS4wNyBtCjM5Ni43NyAyMTguMzEgbApTClEKMC4yMCBHCjEuMjAgdwozOTYuNzcgMTk1LjA3IG0KNDIwLjAyIDE5NS4wNyBsClMKNDIwLjAyIDE5NS4wNyBtIDQyMC4wMiAyMDcuOTEgNDA5LjYxIDIxOC4zMSAzOTYuNzcgMjE4LjMxIGMgUwpCVCAvRjEgNyBUZiA0MDAuNzcgMjIxLjMxIFRkIChEMDMpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNDk4LjgyIDE3MC45OCBtCjQ5OC44MiAxOTEuMzkgbApTClEKMC4yMCBHCjEuMjAgdwo0OTguODIgMTcwLjk4IG0KNTE5LjIzIDE3MC45OCBsClMKNTE5LjIzIDE3MC45OCBtIDUxOS4yMyAxODIuMjUgNTEwLjA5IDE5MS4zOSA0OTguODIgMTkxLjM5IGMgUwpCVCAvRjEgNyBUZiA1MDIuODIgMTk0LjM5IFRkIChEMDQpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNDk4LjgyIDIyNy42NyBtCjQ5OC44MiAyNDguMDggbApTClEKMC4yMCBHCjEuMjAgdwo0OTguODIgMjI3LjY3IG0KNTE5LjIzIDIyNy42NyBsClMKNTE5LjIzIDIyNy42NyBtIDUxOS4yMyAyMzguOTQgNTEwLjA5IDI0OC4wOCA0OTguODIgMjQ4LjA4IGMgUwpCVCAvRjEgNyBUZiA1MDIuODIgMjUxLjA4IFRkIChEMDUpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzQ4LjU4IDI2My4zOSBtCjM4Mi42MCAyNjMuMzkgbApTClEKMC4yMCBHCjEuMjAgdwozNDguNTggMjYzLjM5IG0KMzQ4LjU4IDI5Ny40MCBsClMKMzQ4LjU4IDI5Ny40MCBtIDM2Ny4zNyAyOTcuNDAgMzgyLjYwIDI4Mi4xNyAzODIuNjAgMjYzLjM5IGMgUwpCVCAvRjEgNyBUZiAzNTcuNTkgMjY4LjM5IFRkIChEMDYpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzM0LjQxIDM1MC45OCBtCjMzNC40MSAzNzQuMjIgbApTClEKMC4yMCBHCjEuMjAgdwozMzQuNDEgMzUwLjk4IG0KMzU3LjY1IDM1MC45OCBsClMKMzU3LjY1IDM1MC45OCBtIDM1Ny42NSAzNjMuODEgMzQ3LjI1IDM3NC4yMiAzMzQuNDEgMzc0LjIyIGMgUwpCVCAvRjEgNyBUZiAzMzguNDEgMzc3LjIyIFRkIChEMDcpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMTkyLjM5IDMyMC4wOCBtCjIxNS42NCAzMjAuMDggbApTClEKMC4yMCBHCjEuMjAgdwoxOTIuMzkgMzIwLjA4IG0KMTkyLjM5IDM0My4zMiBsClMKMTkyLjM5IDM0My4zMiBtIDIwNS4yMyAzNDMuMzIgMjE1LjY0IDMzMi45MiAyMTUuNjQgMzIwLjA4IGMgUwpCVCAvRjEgNyBUZiAxOTYuMDIgMzI1LjA4IFRkIChEMDgpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMTcwLjAwIDM1MC45OCBtCjE3MC4wMCAzNzQuMjIgbApTClEKMC4yMCBHCjEuMjAgdwoxNzAuMDAgMzUwLjk4IG0KMTkzLjI0IDM1MC45OCBsClMKMTkzLjI0IDM1MC45OCBtIDE5My4yNCAzNjMuODEgMTgyLjg0IDM3NC4yMiAxNzAuMDAgMzc0LjIyIGMgUwpCVCAvRjEgNyBUZiAxNzQuMDAgMzc3LjIyIFRkIChEMDkpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNTY2Ljg1IDM0Mi43NiBtCjU2Ni44NSA0MTAuNzkgbApTClEKMC4yMCBHCjEuMjAgdwo1NjYuODUgMzQyLjc2IG0KNjM0Ljg4IDM0Mi43NiBsClMKNjM0Ljg4IDM0Mi43NiBtIDYzNC44OCAzODAuMzMgNjA0LjQyIDQxMC43OSA1NjYuODUgNDEwLjc5IGMgUwpCVCAvRjEgNyBUZiA1NzQuODUgNDEzLjc5IFRkIChEMTApIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNDIyLjI4IDE1MC4wMCBtCjQ3My4zMSAxNTAuMDAgbApTClEKMC4zMCBHCjAuODAgdwo0MjIuMjggMTQ4LjAwIG0KNDczLjMxIDE0OC4wMCBsClMKNDIyLjI4IDE1MC4wMCBtCjQ3My4zMSAxNTAuMDAgbApTCjQyMi4yOCAxNTIuMDAgbQo0NzMuMzEgMTUyLjAwIGwKUwpCVCAvRjEgNyBUZiA0MzkuODAgMTM0LjAwIFRkIChXMDEpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNTE1LjgzIDE1MC4wMCBtCjU0OS44NCAxNTAuMDAgbApTClEKMC4zMCBHCjAuODAgdwo1MTUuODMgMTQ4LjAwIG0KNTQ5Ljg0IDE0OC4wMCBsClMKNTE1LjgzIDE1MC4wMCBtCjU0OS44NCAxNTAuMDAgbApTCjUxNS44MyAxNTIuMDAgbQo1NDkuODQgMTUyLjAwIGwKUwpCVCAvRjEgNyBUZiA1MjQuODMgMTM0LjAwIFRkIChXMDIpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMzY1LjU5IDQwNS4xMiBtCjQzMy42MiA0MDUuMTIgbApTClEKMC4zMCBHCjAuODAgdwozNjUuNTkgNDAzLjEyIG0KNDMzLjYyIDQwMy4xMiBsClMKMzY1LjU5IDQwNS4xMiBtCjQzMy42MiA0MDUuMTIgbApTCjM2NS41OSA0MDcuMTIgbQo0MzMuNjIgNDA3LjEyIGwKUwpCVCAvRjEgNyBUZiAzOTEuNjEgNDEzLjEyIFRkIChXMDMpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMjY0Ljk2IDQwNS4xMiBtCjMwNy40OCA0MDUuMTIgbApTClEKMC4zMCBHCjAuODAgdwoyNjQuOTYgNDAzLjEyIG0KMzA3LjQ4IDQwMy4xMiBsClMKMjY0Ljk2IDQwNS4xMiBtCjMwNy40OCA0MDUuMTIgbApTCjI2NC45NiA0MDcuMTIgbQozMDcuNDggNDA3LjEyIGwKUwpCVCAvRjEgNyBUZiAyNzguMjIgNDEzLjEyIFRkIChXMDQpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKMTkxLjI2IDQwNS4xMiBtCjIxNi43NyA0MDUuMTIgbApTClEKMC4zMCBHCjAuODAgdwoxOTEuMjYgNDAzLjEyIG0KMjE2Ljc3IDQwMy4xMiBsClMKMTkxLjI2IDQwNS4xMiBtCjIxNi43NyA0MDUuMTIgbApTCjE5MS4yNiA0MDcuMTIgbQoyMTYuNzcgNDA3LjEyIGwKUwpCVCAvRjEgNyBUZiAxOTYuMDIgNDEzLjEyIFRkIChXMDUpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNDkwLjMxIDQwNS4xMiBtCjU0MS4zNCA0MDUuMTIgbApTClEKMC4zMCBHCjAuODAgdwo0OTAuMzEgNDAzLjEyIG0KNTQxLjM0IDQwMy4xMiBsClMKNDkwLjMxIDQwNS4xMiBtCjU0MS4zNCA0MDUuMTIgbApTCjQ5MC4zMSA0MDcuMTIgbQo1NDEuMzQgNDA3LjEyIGwKUwpCVCAvRjEgNyBUZiA1MDcuODMgNDEzLjEyIFRkIChXMDYpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNTY2Ljg1IDI4MC4zOSBtCjU2Ni44NSAzMzEuNDIgbApTClEKMC4zMCBHCjAuODAgdwo1NjQuODUgMjgwLjM5IG0KNTY0Ljg1IDMzMS40MiBsClMKNTY2Ljg1IDI4MC4zOSBtCjU2Ni44NSAzMzEuNDIgbApTCjU2OC44NSAyODAuMzkgbQo1NjguODUgMzMxLjQyIGwKUwpCVCAvRjEgNyBUZiA1NzQuODUgMzAyLjkxIFRkIChXMDcpIFRqIEVUCnEgMSBnIDEgRwo4LjAwIHcKNTY2Ljg1IDIyNS4xMiBtCjU2Ni44NSAyNTAuNjMgbApTClEKMC4zMCBHCjAuODAgdwo1NjQuODUgMjI1LjEyIG0KNTY0Ljg1IDI1MC42MyBsClMKNTY2Ljg1IDIyNS4xMiBtCjU2Ni44NSAyNTAuNjMgbApTCjU2OC44NSAyMjUuMTIgbQo1NjguODUgMjUwLjYzIGwKUwpCVCAvRjEgNyBUZiA1NzQuODUgMjM0Ljg3IFRkIChXMDgpIFRqIEVUCjAuMDAgRwowLjYwIHcKMTcwLjAwIDEyMS42NSBtCjU2Ni44NSAxMjEuNjUgbApTCjE3MC4wMCAxMTUuNjUgbQoxNzAuMDAgMTI3LjY1IGwKUwoxNzAuMDAgMTQ2LjAwIG0KMTcwLjAwIDExMy42NSBsClMKMzM0LjQxIDExNS42NSBtCjMzNC40MSAxMjcuNjUgbApTCjMzNC40MSAxNDYuMDAgbQozMzQuNDEgMTEzLjY1IGwKUwozOTYuNzcgMTE1LjY1IG0KMzk2Ljc3IDEyNy42NSBsClMKMzk2Ljc3IDE0Ni4wMCBtCjM5Ni43NyAxMTMuNjUgbApTCjQ5OC44MiAxMTUuNjUgbQo0OTguODIgMTI3LjY1IGwKUwo0OTguODIgMTQ2LjAwIG0KNDk4LjgyIDExMy42NSBsClMKNTY2Ljg1IDExNS42NSBtCjU2Ni44NSAxMjcuNjUgbApTCjU2Ni44NSAxNDYuMDAgbQo1NjYuODUgMTEzLjY1IGwKUwpCVCAvRjEgNyBUZiAyNDMuNDAgMTI1LjY1IFRkICg1ODAwKSBUaiBFVApCVCAvRjEgNyBUZiAzNTYuNzkgMTI1LjY1IFRkICgyMjAwKSBUaiBFVApCVCAvRjEgNyBUZiA0MzkuMDAgMTI1LjY1IFRkICgzNjAwKSBUaiBFVApCVCAvRjEgNyBUZiA1MjQuMDMgMTI1LjY1IFRkICgyNDAwKSBUaiBFVApCVCAvRjEgOCBUZiAzNTYuNDMgMTAzLjY1IFRkICgxNCAwMDApIFRqIEVUCjE0MS42NSAxNTAuMDAgbQoxNDEuNjUgNDA1LjEyIGwKUwoxMzUuNjUgMTUwLjAwIG0KMTQ3LjY1IDE1MC4wMCBsClMKMTY2LjAwIDE1MC4wMCBtCjE0OS42NSAxNTAuMDAgbApTCjEzNS42NSAyNjMuMzkgbQoxNDcuNjUgMjYzLjM5IGwKUwoxNjYuMDAgMjYzLjM5IG0KMTQ5LjY1IDI2My4zOSBsClMKMTM1LjY1IDMyMC4wOCBtCjE0Ny42NSAzMjAuMDggbApTCjE2Ni4wMCAzMjAuMDggbQoxNDkuNjUgMzIwLjA4IGwKUwoxMzUuNjUgNDA1LjEyIG0KMTQ3LjY1IDQwNS4xMiBsClMKMTY2LjAwIDQwNS4xMiBtCjE0OS42NSA0MDUuMTIgbApTCkJUIC9GMSA3IFRmIDAgMSAtMSAwIDEzNy42NSAxOTcuODkgVG0gKDQwMDApIFRqIEVUCkJUIC9GMSA3IFRmIDAgMSAtMSAwIDEzNy42NSAyODIuOTMgVG0gKDIwMDApIFRqIEVUCkJUIC9GMSA3IFRmIDAgMSAtMSAwIDEzNy42NSAzNTMuODAgVG0gKDMwMDApIFRqIEVUCkJUIC9GMSA4IFRmIDAgMSAtMSAwIDEyMy42NSAyNjUuNTYgVG0gKDkgMDAwKSBUaiBFVApCVCAvRjIgMTQgVGYgMTcwLjAwIDQ0NS4xMiBUZCAoR1JPVU5EIEZMT09SIFBMQU4pIFRqIEVUCkJUIC9GMSA5IFRmIDE3MC4wMCA0MjkuMTIgVGQgKFNDQUxFIDE6MTAwIEAgQTMpIFRqIEVUCkJUIC9GMiA5IFRmIDU5NS4yMCAzOTMuNzggVGQgKERPT1IgU0NIRURVTEUpIFRqIEVUCkJUIC9GMSA3IFRmIDU5NS4yMCAzNzkuNzggVGQgKEQwMSkgVGogRVQKQlQgL0YxIDcgVGYgNjI5LjIwIDM3OS43OCBUZCAoMjA0MCB4IDkyMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDM3OS43OCBUZCAoRU5UUlkgRE9PUiBISU5HRUQpIFRqIEVUCkJUIC9GMSA3IFRmIDU5NS4yMCAzNjUuNzggVGQgKEQwMikgVGogRVQKQlQgL0YxIDcgVGYgNjI5LjIwIDM2NS43OCBUZCAoMjA0MCB4IDgyMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDM2NS43OCBUZCAoSElOR0VEIFNPTElEIENPUkUgU0VMRiBDTE9TSU5HKSBUaiBFVApCVCAvRjEgNyBUZiA1OTUuMjAgMzUxLjc4IFRkIChEMDMpIFRqIEVUCkJUIC9GMSA3IFRmIDYyOS4yMCAzNTEuNzggVGQgKDIwNDAgeCA4MjApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAzNTEuNzggVGQgKEhJTkdFRCkgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDMzNy43OCBUZCAoRDA0KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMzM3Ljc4IFRkICgyMDQwIHggNzIwKSBUaiBFVApCVCAvRjEgNyBUZiA2ODUuMjAgMzM3Ljc4IFRkIChDQVZJVFkgU0xJREVSKSBUaiBFVApCVCAvRjEgNyBUZiA1OTUuMjAgMzIzLjc4IFRkIChEMDUpIFRqIEVUCkJUIC9GMSA3IFRmIDYyOS4yMCAzMjMuNzggVGQgKDIwNDAgeCA3MjApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAzMjMuNzggVGQgKEhJTkdFRCkgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDMwOS43OCBUZCAoRDA2KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMzA5Ljc4IFRkICgyMDQwIHggMTIwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDMwOS43OCBUZCAoQ0FTRUQgT1BFTklORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDI5NS43OCBUZCAoRDA3KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMjk1Ljc4IFRkICgyMDQwIHggODIwKSBUaiBFVApCVCAvRjEgNyBUZiA2ODUuMjAgMjk1Ljc4IFRkIChISU5HRUQpIFRqIEVUCkJUIC9GMSA3IFRmIDU5NS4yMCAyODEuNzggVGQgKEQwOCkgVGogRVQKQlQgL0YxIDcgVGYgNjI5LjIwIDI4MS43OCBUZCAoMjA0MCB4IDgyMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDI4MS43OCBUZCAoSElOR0VEKSBUaiBFVApCVCAvRjEgNyBUZiA1OTUuMjAgMjY3Ljc4IFRkIChEMDkpIFRqIEVUCkJUIC9GMSA3IFRmIDYyOS4yMCAyNjcuNzggVGQgKDIwNDAgeCA4MjApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAyNjcuNzggVGQgKEVYVEVSTkFMIEhJTkdFRCkgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDI1My43OCBUZCAoRDEwKSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMjUzLjc4IFRkICgyMTAwIHggMjQwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDI1My43OCBUZCAoQUxVTUlOSVVNIFNMSURJTkcgRE9PUikgVGogRVQKQlQgL0YyIDkgVGYgNTk1LjIwIDIyNS43OCBUZCAoV0lORE9XIFNDSEVEVUxFKSBUaiBFVApCVCAvRjEgNyBUZiA1OTUuMjAgMjExLjc4IFRkIChXMDEpIFRqIEVUCkJUIC9GMSA3IFRmIDYyOS4yMCAyMTEuNzggVGQgKDEyMDAgeCAxODAwKSBUaiBFVApCVCAvRjEgNyBUZiA2ODUuMjAgMjExLjc4IFRkIChTTElESU5HKSBUaiBFVApCVCAvRjEgNyBUZiA1OTUuMjAgMTk3Ljc4IFRkIChXMDIpIFRqIEVUCkJUIC9GMSA3IFRmIDYyOS4yMCAxOTcuNzggVGQgKDYwMCB4IDEyMDApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAxOTcuNzggVGQgKEFXTklORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDE4My43OCBUZCAoVzAzKSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTgzLjc4IFRkICgxMjAwIHggMjQwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDE4My43OCBUZCAoU0xJRElORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDE2OS43OCBUZCAoVzA0KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTY5Ljc4IFRkICgxMjAwIHggMTUwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDE2OS43OCBUZCAoU0xJRElORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDE1NS43OCBUZCAoVzA1KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTU1Ljc4IFRkICg2MDAgeCA5MDApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAxNTUuNzggVGQgKEFXTklORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDE0MS43OCBUZCAoVzA2KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTQxLjc4IFRkICgxMjAwIHggMTgwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDE0MS43OCBUZCAoU0xJRElORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDEyNy43OCBUZCAoVzA3KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTI3Ljc4IFRkICgxMjAwIHggMTgwMCkgVGogRVQKQlQgL0YxIDcgVGYgNjg1LjIwIDEyNy43OCBUZCAoU0xJRElORykgVGogRVQKQlQgL0YxIDcgVGYgNTk1LjIwIDExMy43OCBUZCAoVzA4KSBUaiBFVApCVCAvRjEgNyBUZiA2MjkuMjAgMTEzLjc4IFRkICg2MDAgeCA5MDApIFRqIEVUCkJUIC9GMSA3IFRmIDY4NS4yMCAxMTMuNzggVGQgKEFXTklORykgVGogRVQKMC4wMCBHCjEuMDAgdwo4NjAuNTUgMzAuMDAgMzAwLjAwIDcwLjAwIHJlClMKQlQgL0YyIDExIFRmIDg3MC41NSA4MC4wMCBUZCAoU0FNUExFIFJFU0lERU5DRSkgVGogRVQKQlQgL0YxIDcgVGYgODcwLjU1IDY0LjAwIFRkICgxMiBFWEFNUExFIFNUUkVFVCAgLSAgREVNT05TVFJBVElPTiBQTEFOIE9OTFkpIFRqIEVUCkJUIC9GMSA3IFRmIDg3MC41NSA0OC4wMCBUZCAoU0hFRVQgQS0wMiAgIEdST1VORCBGTE9PUiBQTEFOICAgMToxMDAgQCBBMykgVGogRVQKQlQgL0YxIDYgVGYgODcwLjU1IDM2LjAwIFRkIChTYW1wbGUgZHJhd2luZyBnZW5lcmF0ZWQgZm9yIHRoZSBUcmltICYgRG9vciBUYWtlb2ZmIGFwcCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyA+PgplbmRvYmoKNiAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyA+PgplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjU4IDAwMDAwIG4gCjAwMDAwMDk1MjEgMDAwMDAgbiAKMDAwMDAwOTYxOCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDcgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjk3MjAKJSVFT0YK';
const PT_MM = 25.4 / 72;                     // paper millimetres per PDF point
const MONO = '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fm = mm => (num(mm) / 1000).toFixed(2);          // mm → metres, 2 dp
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'takeoff';

function toast(msg, ms = 3000) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- modal ---------- */
const modal = {
  open({ title, body, ok = 'OK', cancel = 'Cancel', onOk = null, onOpen = null }) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body;
    $('#modalOk').textContent = ok; $('#modalOk').hidden = ok === null;
    $('#modalCancel').textContent = cancel || 'Cancel'; $('#modalCancel').hidden = cancel === null;
    $('#modal').hidden = false; modal._onOk = onOk;
    if (onOpen) onOpen();
    const f = $('#modalBody').querySelector('input:not([type=checkbox]),select,textarea,button');
    if (f) { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); }
  },
  close() { $('#modal').hidden = true; modal._onOk = null; },
  text(title, text, filename) {
    modal.open({ title, body: `<p class="small muted">Copy this text${filename ? ` and save it as <b>${esc(filename)}</b>` : ''}.</p><textarea id="modalText" readonly></textarea>`, ok: 'Copy', cancel: 'Close',
      onOpen: () => { $('#modalText').value = text; },
      onOk: () => { copyText(text); return false; } });
  }
};
$('#modalOk').addEventListener('click', () => { if (modal._onOk && modal._onOk() === false) return; modal.close(); });
$('#modalCancel').addEventListener('click', () => modal.close());
$('#modal').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('#modalOk').click(); }
  if (e.key === 'Escape') modal.close();
});
$('#modal').addEventListener('pointerdown', e => { if (e.target === $('#modal')) modal.close(); });
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch (e) { const ta = $('#modalText'); if (ta) { ta.focus(); ta.select(); } toast('Select the text and copy it (Ctrl+C)'); }
}

/* ---------- spec, door types, room rules ---------- */
const DEFAULT_SPEC = {
  skirtProfile: 'Bevelled', skirtSize: '92x18', skirtMaterial: 'Primed MDF', skirtStock: 5400, skirtWaste: 10, skirtColour: '', skirtRate: 0, skirtUnit: 'length',
  archProfile: 'Bevelled', archSize: '67x18', archMaterial: 'Primed MDF', archStock: 5400, archWaste: 10, archColour: '', archRate: 0, archUnit: 'length',
  windowsArch: true, openingAllowance: 200, archLegAllow: 100, archHeadAllow: 250, archWinAllow: 150,
  skirtWet: false, skirtRobes: true, skirtExternal: false,
  doorHeight: 2040, doorWidth: 820, doorThick: 35, doorLeaf: 'Flush panel primed', extLeaf: 'Solid core primed', jamb: '90x35 primed pine',
  doorColour: '', frameColour: '', hardware: '', doorRate: 0, notes: ''
};
const DOOR_TYPES = {
  hinged:   { label: 'Hinged internal', arch: 2, hinges: true, lever: 'auto', stop: true },
  cavity:   { label: 'Cavity slider', arch: 2, cavity: true, lever: 'cavity' },
  robe:     { label: 'Sliding robe doors', arch: 1, track: 'Sliding robe track set', leaves: 2, lever: 'none' },
  bifold:   { label: 'Bifold', arch: 1, track: 'Bifold track set', leaves: 2, lever: 'none' },
  cased:    { label: 'Cased opening (no door)', arch: 2, noLeaf: true, lever: 'none' },
  entry:    { label: 'Entry door', arch: 1, ext: true, hinges: true, lever: 'entrance', stop: true, width: 920 },
  external: { label: 'External hinged', arch: 1, ext: true, hinges: true, lever: 'entrance', stop: true },
  garage:   { label: 'Garage access (self-closing)', arch: 1, ext: true, hinges: true, lever: 'entrance', closer: true, fire: true },
  extslide: { label: 'External sliding / stacker (by others)', arch: 1, noLeaf: true, byOthers: true, lever: 'none', height: 2100, width: 2400 },
  extother: { label: 'External door by others (aluminium / pivot)', arch: 1, noLeaf: true, byOthers: true, lever: 'none' },
  barn:     { label: 'Barn door', arch: 2, track: 'Barn door track set', lever: 'none' },
  robeOthers: { label: 'Robe sliding doors (by robe supplier)', arch: 1, noLeaf: true, byOthers: true, lever: 'none', height: 2100 }
};
const LEVER_LABEL = { passage: 'Passage lever set', privacy: 'Privacy lever set', entrance: 'Entrance set', dummy: 'Dummy lever', cavity: 'Cavity slider set (flush pull)' };
const WET_RE = /\b(BATH|BATHROOM|ENS|ENSUITE|WC|W\.C|PDR|POWDER|TOILET|LAUNDRY|LDRY|L'DRY)\b/i;
const EXT_RE = /\b(ALFRESCO|PORCH|PATIO|VERANDAH?|BALCONY|DECK|TERRACE|CARPORT|PORTICO)\b/i;   // outdoor areas: no skirting. Garages are ordinary rooms and get skirting.
const ROBE_RE = /\b(WIR|ROBE|WARDROBE|WALK[- ]?IN)\b/i;
function defaultSkirting(name) {
  const n = String(name || '');
  if (EXT_RE.test(n)) return !!S.spec.skirtExternal;
  if (WET_RE.test(n)) return !!S.spec.skirtWet;
  if (ROBE_RE.test(n)) return !!S.spec.skirtRobes;
  return true;
}

/* ---------- state ---------- */
const S = { v: 1, project: { name: '', pdfName: '', pageCount: 0, lastPage: 1, aiTier: 'complex' }, spec: { ...DEFAULT_SPEC }, pages: {}, rooms: [], doors: [], windows: [] };
const V = { pdf: null, bytes: null, name: '', pageNum: 1, page: null, base: null, zoom: 1, dpr: 1, tool: 'select', sel: null, draft: null, drag: null, hover: null, text: {}, renderId: 0, renderTask: null, space: false };
const UI = { tab: 'spec', openRoom: null, openDoor: null, openWin: null };
const CAP = { sample: null, downloads: null, images: false, maxImages: 1, ready: false };

const undo = {
  stack: [],
  push() {
    this.stack.push(JSON.stringify({ rooms: S.rooms, doors: S.doors, windows: S.windows, pages: S.pages, spec: S.spec }));
    if (this.stack.length > 80) this.stack.shift();
    $('#btnUndo').disabled = false;
  },
  pop() {
    const s = this.stack.pop(); if (!s) return;
    Object.assign(S, JSON.parse(s)); V.sel = null; V.draft = null; V.place = null; V.retrace = null;
    renderSpec(); renderAll(); toast('Undone');
    $('#btnUndo').disabled = !this.stack.length;
  }
};

let saveT = null;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 400); }
function saveNow() { try { localStorage.setItem('tdt.project', JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
function loadSaved() {
  try {
    const s = localStorage.getItem('tdt.project'); if (!s) return false;
    const o = JSON.parse(s); if (!o || !Array.isArray(o.rooms)) return false;
    applyProject(o); return true;
  } catch (e) { return false; }
}
function applyProject(o) {
  S.project = { ...S.project, ...(o.project || {}) };
  S.spec = { ...DEFAULT_SPEC, ...(o.spec || {}) };
  S.pages = o.pages || {}; S.rooms = o.rooms || []; S.doors = o.doors || []; S.windows = o.windows || [];
  for (const r of S.rooms) { r.deductions = r.deductions || []; if (!r.method) r.method = r.pts ? 'trace' : 'dims'; }
}
function loadDefaultSpec() { try { const s = localStorage.getItem('tdt.spec'); if (s) return { ...DEFAULT_SPEC, ...JSON.parse(s) }; } catch (e) { } return { ...DEFAULT_SPEC }; }

/* ---------- IndexedDB (keeps the last PDF so a reload restores it) ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    try { const r = indexedDB.open('tdt', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
}
async function idbPut(key, val) {
  try { const db = await idbOpen(); await new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  catch (e) { /* ignore */ }
}
async function idbGet(key) {
  try { const db = await idbOpen(); return await new Promise((res, rej) => { const t = db.transaction('files'); const q = t.objectStore('files').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  catch (e) { return null; }
}

/* ---------- file save (downloads capability in the viewer, <a download> elsewhere, copy box as last resort) ---------- */
async function saveFile(filename, text) {
  if (CAP.downloads) {
    try { await CAP.downloads.save({ filename, data: text }); toast('Saved ' + filename); return; }
    catch (e) { if (e && e.code === 'declined') return; /* fall through */ }
  }
  if (!window.claude) {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Downloaded ' + filename); return;
    } catch (e) { /* fall through */ }
  }
  modal.text('Save ' + filename, text, filename);
}

/* ---------- runtime capabilities (published artifact only) ---------- */
(async function initCaps() {
  if (!window.claude || typeof window.claude.use !== 'function') { CAP.ready = true; return; }
  try { CAP.downloads = await window.claude.use('downloads'); } catch (e) { }
  try {
    CAP.sample = await window.claude.use('sample');
    if (CAP.sample && CAP.sample.limits) {
      const lim = await CAP.sample.limits().catch(() => null);
      CAP.images = !!(lim && lim.images); CAP.maxImages = (lim && lim.images && lim.images.maxCount) || 1;
    }
  } catch (e) { }
  CAP.ready = true; updateCapUI();
})();
function updateCapUI() {
  const on = !!CAP.sample;
  $$('[data-tool="ai"]').forEach(b => { b.hidden = !on; });
  $$('.ai-only').forEach(b => { b.hidden = !on; });
}
