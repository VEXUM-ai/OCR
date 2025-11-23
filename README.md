# OCR Web (Static client-side OCR)

ブラウザ内で完結するOCRページです。JPG / PNG / PDF をアップロードすると tesseract.js + pdf.js でその場で文字起こしします。ファイルはサーバーへ送信されません。

## 特長
- 画像(JPG/PNG)とPDFに対応、複数ファイルをまとめて処理可能
- 処理状況と進捗を表示（tesseract.js の logger を利用）
- 完全クライアント実行のため Vercel の静的ホスティングでそのまま動作

## ローカルで試す
1. このディレクトリに移動  
   `cd OCR_repo`
2. 簡易サーバーで静的配信（CORS回避のため推奨）  
   - `npx serve .` もしくは `python -m http.server 3000`
3. ブラウザで `http://localhost:3000` を開き、ファイルをドロップ/選択。

## ファイル構成
- `index.html` : UI 本体（CDN から pdf.js / tesseract.js を読み込み）
- `style.css` : スタイル
- `main.js` : 処理ロジック

## Vercel へのデプロイ（GitHub 経由）
1. このリポジトリを GitHub にプッシュ。  
2. Vercel で「Import Project」を選択し、このリポジトリを指定。  
3. Project Settings  
   - Framework Preset: **Other**（静的サイト）  
   - Root Directory: リポジトリ直下（`index.html` がある場所）  
   - Build Command / Install Command: **空**（ビルドなしでOK）  
4. デプロイ後の URL にアクセスし、トップページで OCR が利用できます。

## 設定メモ
- 認識言語は `jpn+eng`。変更する場合は `main.js` の `LANG` を更新し、同時に `LANG_PATH` を適宜差し替えてください。
- PDF は 1.5 倍スケールでレンダリングしてから OCR しています。精度を上げたい場合は `viewport` の `scale` を大きくしてください。
- 企業ネットワーク等で CDN がブロックされる場合は、`WORKER_PATH` / `CORE_PATH` / `LANG_PATH` / `pdf.worker.min.js` の URL を自前 CDN に差し替えてください。

## バージョン管理メモ
```
git init
git add .
git commit -m "Add static browser OCR (jpg/png/pdf) using tesseract.js"
git branch -M main
git remote add origin git@github.com:VEXUM-ai/OCR.git
git push -u origin main
```
