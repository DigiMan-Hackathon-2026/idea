#!/bin/bash
# index.html(파스텔) → seoul-color.html(서울대표색) 변환 스크립트
# 사용법: bash build-seoul-color.sh
set -e
cd "$(dirname "$0")"
cp index.html seoul-color.html
sed -i '' \
 -e 's/#FBF5EC/#F4F3F0/g' -e 's/#FFFDF8/#FFFFFF/g' -e 's/#F6C3AE/#DCCCAC/g' -e 's/#FCE3D7/#EFE7D6/g' \
 -e 's/#E8806A/#AE1932/g' -e 's/#D9654E/#8E1428/g' -e 's/#B5D3EF/#BCD0EC/g' -e 's/#5B8DC0/#558BCF/g' \
 -e 's/#F6D27A/#F6B65A/g' -e 's/#BFE3CF/#CFE0D9/g' -e 's/#D9CDF2/#E0DFDE/g' -e 's/#2B2522/#2F2D29/g' \
 -e 's/#6B605A/#504E48/g' -e 's/#A59A93/#8F8C84/g' -e 's/#EFE5D8/#E4E2DD/g' -e 's/#F3E7DA/#E9E8E5/g' \
 -e 's/#F9D9C8/#F2DCDF/g' -e 's/#DCE8F5/#D6E2F2/g' -e 's/#F6EEE4/#EEEDE9/g' -e 's/#F1E7DB/#E9E7E2/g' \
 -e 's/#E4D6C5/#D6D3CC/g' -e 's/#F8F0E6/#F1F0EC/g' -e 's/#DCCDBB/#C9C6BE/g' -e 's/#D8CABB/#CFCCC4/g' \
 -e 's/#F2BF55/#E9A03C/g' -e 's/#F4A08C/#E7897F/g' \
 -e 's/rgba(232,128,106/rgba(174,25,50/g' -e 's/rgba(246,210,122/rgba(246,182,90/g' -e 's/rgba(246,195,174/rgba(220,204,172/g' \
 -e 's/rgba(91,141,192/rgba(85,139,207/g' -e 's/rgba(120,80,50/rgba(60,55,50/g' -e 's/rgba(80,50,30/rgba(50,45,40/g' \
 -e 's/rgba(60,30,10/rgba(30,28,25/g' -e 's/rgba(43,37,34/rgba(47,45,41/g' \
 -e 's/#EEF2E6/#EEEFEA/g' -e 's/#EAF1E6/#EEEFEA/g' -e 's/#D7E8F2/#C9DAF0/g' -e 's/#E2EBD7/#D6E3DD/g' -e 's/#F6E5C8/#F3D9AE/g' \
 seoul-color.html

# 서울색 견본 CSS + 구매 문구 카드 남산초록색
perl -0pi -e 's|\@media \(max-width:860px\)\{\.side\{display:none\}\}|.swatches{margin-top:26px;display:grid;gap:8px}\n.swatches p{font-size:11px;font-weight:700;color:var(--ink-3);letter-spacing:.06em;margin-bottom:2px}\n.sw{display:flex;align-items:center;gap:10px;font-size:12px}\n.sw i{width:28px;height:28px;border-radius:9px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}\n.sw small{color:var(--ink-3);font-family:ui-monospace,monospace;margin-left:auto}\n\@media (max-width:860px){.side{display:none}}\n.phrase{background:#345F53 !important}|' seoul-color.html

# 서울색 견본 HTML
NL=$'\n'
SW="  <div class=\"swatches\">${NL}    <p>SEOUL COLORS · 서울대표색</p>${NL}"
for c in "AE1932 단청빨간색" "558BCF 서울하늘색" "F6B65A 은행노란색" "345F53 남산초록색" "DCCCAC 삼베연미색" "E0DFDE 한강은백색" "504E48 기와진회색"; do
  set -- $c
  SW+="    <div class=\"sw\"><i style=\"background:#$1\"></i>$2<small>#$1</small></div>${NL}"
done
SW+="  </div>${NL}"
SW="$SW" perl -0pi -e 's|(<div class="chips" id="sideChips"></div>\n)|$1$ENV{SW}|' seoul-color.html

grep -q 'SEOUL COLORS' seoul-color.html && grep -q '#345F53 !important' seoul-color.html && echo "seoul-color.html 생성 완료"
