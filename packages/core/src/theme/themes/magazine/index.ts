import type { Theme } from '../../types'
import { hljsDark } from '../../hljs-maps'

/** 杂志编辑风 */
export const theme: Theme = {
  id: 'magazine',
  name: '杂志编辑',
  description: '衬线大刊排版：首字下沉 + 居中引文',
  category: 'narrative',
  previewBackground: '#ffffff',
  hljsStyleMap: hljsDark,
  styles: {
    root: 'color:#1a1a1a;font-size:16px;line-height:1.9;letter-spacing:0.2px;word-break:break-word;font-family:Georgia,"Times New Roman","Songti SC","SimSun",serif;',
    h1: 'margin:1.6em 0 0.6em;font-size:1.7em;font-weight:800;text-align:center;letter-spacing:0.5px;color:#111;',
    h2: 'margin:1.5em 0 0.7em;font-size:1.3em;font-weight:700;color:#111;border-bottom:1px solid #1a1a1a;padding-bottom:0.3em;',
    h3: 'margin:1.4em 0 0.6em;font-size:1.12em;font-weight:700;color:#222;',
    h4: 'margin:1.3em 0 0.5em;font-size:1.04em;font-weight:700;color:#333;',
    h5: 'margin:1.2em 0 0.4em;font-size:1em;font-weight:700;color:#444;',
    h6: 'margin:1.1em 0 0.4em;font-size:0.92em;font-weight:700;color:#555;',
    p: 'margin:1em 0;',
    a: 'color:#0a5ad6;text-decoration:none;border-bottom:1px solid rgba(10,90,214,0.4);',
    strong: 'font-weight:700;color:#111;',
    em: 'font-style:italic;color:#333;',
    del: 'text-decoration:line-through;color:#999;',
    ul: 'margin:1em 0;padding-left:1.6em;',
    ol: 'margin:1em 0;padding-left:1.6em;',
    li: 'margin:0.4em 0;',
    blockquote: 'margin:1.4em 0;padding:0.8em 1.1em;border-left:3px solid #999;background:#f7f7f5;color:#555;font-style:italic;',
    code: 'background:#f4f4f2;color:#c0392b;padding:2px 6px;border-radius:4px;font-size:0.88em;font-family:"SFMono-Regular",Consolas,Menlo,monospace;',
    codeBlock: 'font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;line-height:1.6;color:#e6e6e6;',
    codeBlockWrapper: 'background:#2b2b2b;padding:16px;border-radius:6px;overflow-x:auto;margin:1.4em 0;',
    table: 'border-collapse:collapse;margin:1.4em 0;width:100%;font-size:0.95em;',
    thead: '',
    th: 'border:1px solid #ddd;background:#f2f2f0;padding:9px 13px;font-weight:700;color:#222;',
    td: 'border:1px solid #ddd;padding:9px 13px;',
    tr: '',
    img: 'max-width:100%;border-radius:2px;display:block;margin:1.4em auto;',
    hr: 'border:none;border-top:1px solid #ddd;margin:2.4em 0;',
  },
  customCss: `
.td-rich > p:first-of-type::first-letter {
  font-size: 3.6em;
  float: left;
  line-height: 0.78;
  padding: 0.06em 0.14em 0 0;
  font-weight: 800;
  color: #111;
}
.td-rich blockquote {
  font-size: 1.32em !important;
  line-height: 1.55 !important;
  font-style: italic !important;
  text-align: center !important;
  border: none !important;
  background: transparent !important;
  color: #111 !important;
  padding: 1.2em 0.4em !important;
}
.td-rich blockquote::before,
.td-rich blockquote::after {
  content: "";
  display: block;
  width: 56px;
  height: 2px;
  background: #111;
  margin: 0 auto 0.8em;
}
.td-rich blockquote::after { margin: 0.8em auto 0; }
.td-rich h2 { letter-spacing: 0.04em; }
`,
}
