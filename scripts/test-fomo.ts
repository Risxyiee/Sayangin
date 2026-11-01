// Tes cepat helper FOMO: bun scripts/test-fomo.ts
import { toFomoInitials, buildFomoIdentity } from "../src/utils/fomoLogic"

const cases: Array<[string | null | undefined, string | null]> = [
  ["Rizqi", "R***I"],
  ["rizqi", "R***I"], // upcase konsisten
  ["  Putri   Ayu  ", "P***U"], // spasi berlebih + multi kata
  ["Budi Santoso", "B***O"],
  ["A", "A***"], // nama 1 huruf, jangan diulang
  ["Ai", "A***I"],
  ["123", "1***3"],
  ["   ", null], // kosong
  ["", null],
  [null, null],
  [undefined, null],
  ["🌹🌹🌹", "🌹***"], // emoji dianggap glyph biasa
]

let failed = 0
for (const [input, expected] of cases) {
  const got = toFomoInitials(input)
  const ok = got === expected
  if (!ok) failed++
  console.log(
    `${ok ? "PASS" : "FAIL"}  toFomoInitials(${JSON.stringify(input) ?? "undefined"}) = ${JSON.stringify(got)}  (harap: ${JSON.stringify(expected)})`
  )
}

console.log("")

const anon = buildFomoIdentity("Rizqi", true)
const nama = buildFomoIdentity("  Rizqi ", false)
const kosong = buildFomoIdentity(null, false)

const identityChecks: Array<[string, boolean]> = [
  ["anonim → senderName null", anon.senderName === null],
  ["anonim → fomoInitials null", anon.fomoInitials === null],
  ["nama → senderName di-trim", nama.senderName === "Rizqi"],
  ["nama → fomoInitials R***I", nama.fomoInitials === "R***I"],
  ["null → keduanya null", kosong.senderName === null && kosong.fomoInitials === null],
]

for (const [label, ok] of identityChecks) {
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  buildFomoIdentity: ${label}`)
}

console.log(`\n${failed === 0 ? "SEMUA TES LULUS ✅" : `${failed} tes GAGAL ❌`}`)
process.exit(failed === 0 ? 0 : 1)
