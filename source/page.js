export const page = String.raw`<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#212121">
  <meta name="description" content="Javni pregledovalnik prostih delovnih mest v Sloveniji">
  <title>DeloRadar · Prosta delovna mesta v Sloveniji</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#192b2b;background:#f7f8f5;font-synthesis:none}
    *{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button{cursor:pointer}a{color:inherit}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #76b9a7;outline-offset:2px}
    .shell{max-width:1470px;margin:auto;padding:0 38px}.topbar{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e9e4}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:850;font-size:21px;letter-spacing:-1px}.mark{background:#146a5c;color:#fff;width:34px;height:34px;display:grid;place-items:center;border-radius:11px;font-size:20px;box-shadow:0 3px 0 #bcd7cc}.brand span:last-child{color:#146a5c}.topright{display:flex;gap:12px;align-items:center;font-size:12px;font-weight:700;color:#77827c}.priv{background:#e7f1ed;color:#246c5b;border:1px solid #cde5dc;border-radius:24px;padding:7px 12px}.topright .smalllink{color:#52645e;text-decoration:none}.topright .smalllink:hover{text-decoration:underline}
    .intro{display:flex;align-items:flex-end;justify-content:space-between;gap:25px;padding:43px 0 31px}.eyebrow{color:#16876d;font-size:11px;font-weight:850;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:14px}.intro h1{font-size:clamp(30px,3.2vw,48px);line-height:1.1;letter-spacing:-2px;margin:0 0 11px;font-weight:820}.intro p{margin:0;color:#66716e;font-size:14px;line-height:1.65;max-width:690px}.refresh{display:flex;align-items:center;gap:9px;border:1px solid #cbd9d1;color:#1d6a5a;background:#fff;padding:12px 17px;border-radius:10px;font-weight:760;white-space:nowrap;box-shadow:0 2px 3px #e8ece6}.refresh:hover{background:#eff9f3}.refresh:disabled{opacity:.6;cursor:wait}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.stat{position:relative;border:1px solid #e4eae4;border-radius:14px;padding:21px 24px;background:#fff;min-height:116px}.stat .kicker{font-weight:700;font-size:12px;color:#75817d}.stat .n{display:block;font-weight:850;font-size:30px;letter-spacing:-1px;margin-top:12px;line-height:1}.stat .foot{position:absolute;right:22px;bottom:23px;font-size:11px;color:#8d9a96}.stat.highlight{background:#165f51;color:#fff;border-color:#165f51}.stat.highlight .kicker,.stat.highlight .foot{color:#b5d3ca}.stat.highlight .n{color:#fff}.stat .lightdot{position:absolute;right:22px;top:23px;width:10px;height:10px;border-radius:50%;background:#83dec0;box-shadow:0 0 0 5px #ffffff17}
    .content{display:grid;grid-template-columns:236px minmax(0,1fr);gap:27px;margin-top:29px;align-items:start}.sidebar{display:flex;flex-direction:column;gap:18px}.panel{background:#fff;border:1px solid #e5ebe5;border-radius:13px;padding:21px}.sectionlabel{font-size:11px;text-transform:uppercase;letter-spacing:1.15px;font-weight:850;color:#8a9791;margin:0 0 18px}.filterhead{display:flex;justify-content:space-between;align-items:center}.clear{color:#0c8269;background:transparent;border:0;font-size:12px;font-weight:750;padding:3px}.filtergroup{margin-bottom:20px}.filtergroup:last-child{margin-bottom:0}.filtergroup label{display:block;font-size:12px;color:#475853;font-weight:800;margin-bottom:8px}.field{width:100%;border:1px solid #e0e7df;border-radius:9px;background:#fbfcfa;padding:10px 11px;font-size:12px;color:#263d36;outline:0}.field:focus{border-color:#61b393;box-shadow:0 0 0 3px #caeee0}.checkrow{display:flex;align-items:center;gap:10px;margin:11px 0;color:#53625d;font-size:12px;cursor:pointer}.checkrow input{accent-color:#167c62;width:15px;height:15px}.sourceitem{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:#52645d;margin:14px 0}.sourceitem .pill{font-size:10px;font-weight:800;color:#207e66;background:#e7f6ec;border-radius:8px;padding:3px 6px}.sourceitem .pill.err{background:#fff1e5;color:#ad6c35}.sourceitem .name{font-weight:700}.srcfooter{font-size:11px;color:#9aa69e;border-top:1px solid #edf0ea;padding-top:15px;line-height:1.7}.asidecallout{border-radius:13px;background:#e7f3ea;border:1px solid #d4e8d8;padding:20px;color:#315e4d}.asidecallout h3{margin:0 0 8px;font-size:13px}.asidecallout p{font-size:11px;line-height:1.65;margin:0 0 10px}.asidecallout button{border:0;background:transparent;color:#0f785e;font-weight:850;font-size:11px;padding:0;text-decoration:underline}
    .mainpanel{min-width:0}.tablehead{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 15px}.tablehead h2{font-size:19px;letter-spacing:-.6px;margin:0}.countsub{color:#8d9992;font-size:12px;font-weight:550;margin-left:8px}.actions{display:flex;align-items:center;gap:9px}.sortselect,.outline{background:#fff;border:1px solid #dfe7de;border-radius:9px;padding:10px 12px;color:#52645d;font-size:12px;font-weight:700}.outline:hover{border-color:#a8c8b7;color:#176b55}.tablewrap{border:1px solid #e5ebe5;background:#fff;border-radius:14px;overflow:hidden}.listtable{border-collapse:collapse;width:100%;table-layout:fixed}.listtable th{text-align:left;font-size:10px;color:#97a39d;text-transform:uppercase;letter-spacing:1px;font-weight:850;background:#fcfdfb;padding:17px 20px;border-bottom:1px solid #e9eee7}.listtable td{padding:17px 20px;border-bottom:1px solid #eef1eb;vertical-align:middle}.listtable tbody tr:last-child td{border:0}.listtable tbody tr:hover{background:#fbfdf9}.jobtitle{font-size:13px;font-weight:800;line-height:1.5;color:#20382f;text-decoration:none;display:block}.jobtitle:hover{color:#0e856a;text-decoration:underline}.jobcompany{color:#8b9790;font-size:11px;margin-top:5px;line-height:1.5}.muted{color:#697b72;font-size:12px}.srcbadge{display:inline-block;font-size:10px;font-weight:800;color:#366a54;background:#eaf5ed;border-radius:6px;padding:6px 9px;white-space:nowrap}.srcbadge.kariera{background:#f1edf9;color:#775998}.dead{font-size:11px;color:#718078}.state{border:1px solid #dfe7e0;background:#fff;color:#718078;border-radius:9px;padding:7px 8px;font-size:11px;max-width:100%}.state.applied{color:#1c775e;background:#eaf8ee;border-color:#bad9c6}.state.saved{color:#9a672f;background:#fff8e9;border-color:#eedbad}.openjob{text-decoration:none;font-size:14px;color:#278469;font-weight:800}.rowactions{display:flex;align-items:center;gap:11px}.star{font-size:18px;border:0;background:none;color:#bac7bf;line-height:1;padding:3px}.star.active{color:#d9a52b}.more{padding:15px 21px;font-size:11px;color:#94a19a;background:#fcfdfa;border-top:1px solid #e9eee9}.empty{padding:52px 24px;text-align:center;color:#738279}.empty .big{font-size:30px;margin-bottom:8px}.empty h3{font-size:16px;color:#2d493b;margin:0 0 7px}.empty p{margin:0 auto;max-width:420px;font-size:12px;line-height:1.65}.loader{height:3px;background:linear-gradient(90deg,#d6eee3,#167f62,#d6eee3);background-size:200% 100%;animation:pulse 1s linear infinite}@keyframes pulse{to{background-position:200% 0}}.notice{margin:0 0 13px;border-radius:8px;padding:10px 13px;font-size:12px;color:#655a3d;background:#fff8e6;border:1px solid #f3e8c2}.refreshinfo{font-size:11px;color:#88978c;margin-top:13px}.bottom{border-top:1px solid #e2e8df;margin:52px 0 0;padding:21px 0 28px;display:flex;justify-content:space-between;gap:14px;color:#99a59e;font-size:11px}.bottom a{color:#668579}.sourcecatalog{display:none;margin-top:35px}.sourcecatalog.show{display:block}.sourcecatalog h2{font-size:20px;margin:0 0 6px}.sourcecatalog>p{margin:0 0 18px;color:#728079;font-size:12px;line-height:1.6}.sourcegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.sourcecard{padding:17px;background:white;border:1px solid #e3e9e1;border-radius:11px}.sourcecard a{font-weight:790;font-size:13px;color:#205b4c;text-decoration:none}.sourcecard a:hover{text-decoration:underline}.sourcecard p{font-size:11px;color:#86948b;line-height:1.55;margin:9px 0 0}.sourcecard .tag{display:inline-block;color:#ab8244;background:#fbf1dd;padding:4px 7px;border-radius:5px;font-size:9px;font-weight:800;text-transform:uppercase;margin-top:12px;letter-spacing:.4px}
    @media(max-width:1100px){.shell{padding:0 24px}.content{grid-template-columns:205px minmax(0,1fr);gap:17px}.listtable th,.listtable td{padding:14px 11px}.listtable th:nth-child(4),.listtable td:nth-child(4){display:none}.stat{padding:20px}.stat .foot{display:none}}
    @media(max-width:770px){.shell{padding:0 16px}.topbar{height:62px}.topright .smalllink{display:none}.intro{display:block;padding:30px 0 22px}.intro h1{letter-spacing:-1.4px}.intro p{font-size:12px}.refresh{margin-top:17px;width:100%;justify-content:center}.stats{grid-template-columns:repeat(2,1fr);gap:9px}.stat{padding:17px;min-height:98px}.stat .n{font-size:26px}.stat .kicker{font-size:11px}.content{grid-template-columns:1fr;margin-top:20px}.sidebar{display:grid;grid-template-columns:1fr 1fr;gap:9px}.panel{padding:15px}.asidecallout{grid-column:1/-1;padding:15px}.tablehead{align-items:flex-start;flex-direction:column}.actions{width:100%;justify-content:space-between}.tablewrap{border:0;background:transparent;overflow:visible}.listtable,.listtable tbody,.listtable tr,.listtable td{display:block;width:100%}.listtable thead{display:none}.listtable tr{position:relative;display:grid;grid-template-columns:1fr auto;gap:9px 15px;border:1px solid #e5ebe5;background:#fff;border-radius:12px;margin-bottom:10px;padding:17px}.listtable td{border:0!important;padding:0!important}.listtable td:nth-child(1){grid-column:1/3;padding-right:20px!important}.listtable td:nth-child(2),.listtable td:nth-child(3){font-size:11px}.listtable td:nth-child(4){display:none}.listtable td:nth-child(5){grid-column:1/2}.listtable td:nth-child(6){grid-column:2/3;justify-self:end}.listtable tbody tr:hover{background:#fff}.rowactions{gap:10px}.jobtitle{font-size:14px}.more{border:1px solid #e5ebe5;border-radius:10px}.sourcegrid{grid-template-columns:repeat(2,1fr)}.bottom{display:block;line-height:1.8}}
    @media(max-width:390px){.sidebar{grid-template-columns:1fr}.sourcegrid{grid-template-columns:1fr}.brand{font-size:19px}}
    /* Bolj berljivi filtri in pojasnila pri testnem lokalnem paketu. */
    .filtergroup label,.field,.checkrow,.sourceitem,.clear{font-size:14px}
    .field{min-height:43px;appearance:none;background-image:linear-gradient(45deg,transparent 50%,#6f867b 50%),linear-gradient(135deg,#6f867b 50%,transparent 50%);background-position:calc(100% - 18px) 19px,calc(100% - 13px) 19px;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:33px}
    input.field{appearance:auto;background-image:none;padding-right:11px}
    .filtergroup small{display:block;color:#89978e;font-size:12px;line-height:1.55;margin-top:6px}
    .filterheading{font-weight:850;font-size:12px;color:#1e8064;margin:19px 0 15px;border-top:1px solid #e6eee7;padding-top:17px;letter-spacing:.3px}
    .previewflag{font-size:12px;font-weight:800;background:#fff1d5;color:#936229;border-radius:7px;padding:8px 11px;margin-left:8px}
    .filtergroup select:disabled{background:#f1f3ef;color:#9aa69f}
    .explain{margin:0 0 13px;padding:11px 13px;border:1px solid #dce6da;background:#f1f7ed;color:#557363;font-size:13px;line-height:1.5;border-radius:9px}
    .multi{position:relative;margin:0}.multi-trigger{width:100%;min-height:43px;border:1px solid #dfe8e0;border-radius:9px;background:#fbfcfa;color:#25493b;padding:10px 12px;text-align:left;display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:680}.multi-trigger .count{font-size:12px;color:#4d876f;margin-left:6px}.multi-menu{position:absolute;left:0;top:calc(100% + 4px);z-index:20;background:white;border:1px solid #cde0d2;border-radius:11px;box-shadow:0 12px 30px #133e3020;padding:10px;min-width:100%;max-width:320px}.multi-menu[hidden]{display:none}.multi-menu .multi-search{width:100%;padding:9px 10px;border:1px solid #d9e7dd;border-radius:7px;margin-bottom:8px;font-size:14px}.multi-options{max-height:215px;overflow-y:auto}.multi-option{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;padding:7px 4px;color:#2e4b3f;cursor:pointer}.multi-option input{accent-color:#147b61;margin:0 7px 0 0}.multi-option small{margin:0;color:#98a99e;font-size:11px}.multi-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.multi-chip{display:inline-flex;gap:5px;align-items:center;border:1px solid #c6e5d6;background:#e8f6ed;border-radius:6px;padding:4px 7px;color:#197357;font-size:11px}.multi-chip button{background:transparent;border:0;color:#197357;font-weight:800;padding:0;font-size:13px}.multi-actions{display:flex;justify-content:flex-end;padding-top:7px;border-top:1px solid #edf2eb;margin-top:5px}.multi-actions button{font-size:12px;color:#127d64;border:0;background:transparent;font-weight:750}
    .mobilefilters{display:none}
    @media(max-width:770px){
      .sidebar{display:flex;flex-direction:column;gap:10px;width:100%}
      .mobilefilters{display:flex;justify-content:space-between;align-items:center;border:1px solid #cadbd0;background:#eaf5ed;color:#155e49;border-radius:10px;padding:14px 17px;width:100%;font-weight:800;font-size:14px}
      .sidebar>.panel:first-of-type{display:none}
      .sidebar.filters-open>.panel:first-of-type{display:block}
      .sidebar>.panel:nth-of-type(2){display:none}
      .sidebar.sources-open>.panel:nth-of-type(2){display:block}
      .asidecallout{display:none}
      .sidebar.sources-open>.asidecallout{display:block}
      .mainpanel{width:100%}
      .multi-menu{width:100%;max-width:none}
    }
    /* Temna različica, navdihnjena z nevtralno grafitno paleto. */
    :root{color-scheme:dark;color:#eeeeee;background:#212121;--base:#212121;--panel:#2f2f2f;--field:#383838;--line:#484848;--muted:#b2b2b2;--accent:#c4b5fd}
    body{background:var(--base)}
    button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline-color:#b3a4ff}
    .topbar,.bottom{border-color:var(--line)}
    .brand span:last-child,.eyebrow,.clear,.sourcecard a,.smalllink,.jobtitle:hover,.openjob,.asidecallout button{color:var(--accent)}
    .mark{background:#51467b;color:#fff;box-shadow:0 3px 0 #272237}
    .priv{background:#373442;color:#d4caff;border-color:#534b68}
    .intro p,.countsub,.stat .kicker,.stat .foot,.filtergroup label,.checkrow,.sourceitem,.sourceitem .name,.srcfooter,.muted,.dead,.refreshinfo,.bottom,.sourcecatalog>p,.sourcecard p,.filtergroup small,.filterheading,.sectionlabel,.more,.sourceitem .name{color:var(--muted)}
    .refresh,.outline,.sortselect,.panel,.stat,.tablewrap,.sourcecard,.field,.multi-trigger,.multi-menu,.multi-menu .multi-search,.state{background:var(--panel);color:#ededed;border-color:var(--line);box-shadow:none}
    .refresh:hover,.outline:hover,.multi-trigger:hover,.state:hover{background:#3b3b3b;color:#fff;border-color:#777087}
    .stat.highlight{background:#48405d;border-color:#635577}
    .stat.highlight .kicker,.stat.highlight .foot{color:#d2c9e7}
    .stat .lightdot{background:#c7b5ff;box-shadow:0 0 0 5px #c4b5fd1c}
    .field:focus,.multi-menu .multi-search:focus{border-color:#b6a6ff;box-shadow:0 0 0 3px #7a69b74d}
    input.field::placeholder,.multi-menu .multi-search::placeholder{color:#a9a9a9}
    .field,.multi-trigger,.multi-menu .multi-search{background-color:var(--field)}
    .filterheading{color:#b8a7f2;border-color:var(--line)}
    .filtergroup select:disabled{background:#292929;color:#929292}
    .checkrow input,.multi-option input{accent-color:#a995ee}
    .multi-menu{background:#303030;box-shadow:0 16px 40px #0008}
    .multi-option{color:#e4e4e4}.multi-option small{color:#a9a9a9}
    .multi-actions{border-color:var(--line)}.multi-actions button{color:var(--accent)}
    .multi-chip{background:#454053;color:#e7dcff;border-color:#645a7e}
    .multi-chip button{color:#e7dcff}
    .tablewrap{background:var(--panel)}
    .listtable th{background:#303030;color:#bcbcbc;border-color:var(--line)}
    .listtable td{border-color:#434343}.listtable tbody tr:hover{background:#393939}
    .jobtitle{color:#f5f5f5}.jobcompany{color:#b4b4b4}
    .srcbadge{background:#414052;color:#dcd3fc}.srcbadge.kariera{background:#423b54;color:#dbc6fd}
    .state.applied{background:#393f53;color:#c9d8ff;border-color:#5c6690}
    .state.saved{background:#4a4039;color:#ffe0b6;border-color:#7a6556}
    .star{color:#a7a7a7}.star.active{color:#f9c977}
    .more{background:#292929;border-color:var(--line)}
    .empty,.empty h3{color:#c9c9c9}
    .notice{background:#494030;border-color:#6b5c3d;color:#ffe3a6}
    .sourceitem .pill{background:#434057;color:#d9caff}
    .sourceitem .pill.err{background:#594038;color:#ffd6c3}
    .srcfooter{border-color:var(--line)}
    .jobalternatives{font-size:11px;line-height:1.6;color:var(--muted);margin-top:6px}
    .jobalternatives a{color:var(--accent);font-weight:700;text-decoration:none}
    .jobalternatives a:hover{text-decoration:underline}
    .sourcesummary{color:var(--muted);font-size:12px;line-height:1.5;margin:0}
    .sourcedetails{border-top:1px solid var(--line);margin-top:12px;padding-top:10px}
    .sourcedetails summary{cursor:pointer;color:var(--accent);font-size:12px;font-weight:750;line-height:1.6}
    .sourcedetails summary:hover{text-decoration:underline}
    .sourcedetails .sourceitem:last-child{margin-bottom:0}
    .asidecallout,.explain{background:#35313d;border-color:#504858;color:#e5deed}
    .asidecallout h3,.asidecallout p,.explain{color:#ddd5e6}
    .sourcecard{background:var(--panel)}
    .sourcecard .tag{background:#4b4140;color:#ffe0ba}
    .mobilefilters{background:#373343;border-color:#514861;color:#e4d9ff}
    .cataloglink{display:block;width:100%;padding:10px 0 0;margin-top:8px;border:0;background:none;color:var(--accent);text-align:left;font-size:12px;font-weight:760}
    .cataloglink:hover{text-decoration:underline}
    .sourcegrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .sourcecard{padding:13px 15px}
    .sourcecard p{margin:5px 0 0;font-size:12px}
    @media(max-width:770px){.sourcegrid{grid-template-columns:1fr}}
    .bottom a{color:var(--accent)}
    .multi-option[hidden]{display:none!important}
    .multi-option small{margin-left:7px;font-variant-numeric:tabular-nums}
    .multi-empty{padding:12px 5px;font-size:13px;color:#aaa}
    .refreshbox{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex:none}
    .refreshbox .refresh{justify-content:center;text-decoration:none}
    .refreshbox .refreshinfo{font-size:12px;text-align:right;line-height:1.5;margin:0;max-width:330px}
    .more button{margin-left:10px;padding:6px 10px;border:1px solid #665b81;border-radius:7px;background:#454053;color:#e7dcff;font-weight:750}
    .filterhead{gap:8px;margin-bottom:18px}.filterhead .sectionlabel{margin:0;letter-spacing:.65px}.filterhead .clear{flex:none;white-space:nowrap;padding:5px 7px;border:1px solid #5b536d;border-radius:7px;background:#3a3644;color:var(--accent);font-size:12px}.filterhead .clear:hover{background:#4b435b;border-color:#8f7ab8}
    .pager{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;margin-top:14px;color:var(--muted);font-size:13px}
    .bottom{margin-top:14px}
    .pager .pagebuttons{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px}
    .pager button{min-width:35px;min-height:35px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:#eee;font-weight:700}
    .pager button[aria-current="page"]{background:#51467b;border-color:#9884d1;color:#fff}
    .pager button:disabled{opacity:.35;cursor:default}
    .pager .pagesize{grid-column:3;justify-self:end;display:flex;align-items:center;gap:8px;white-space:nowrap}
    .pager select{color:#eee;background:var(--panel);border:1px solid var(--line);padding:8px;border-radius:8px}
    .pager .gapdots{padding:0 4px;color:var(--muted)}
    .backtotop{position:fixed;right:24px;bottom:24px;z-index:50;width:46px;height:46px;border:1px solid #8173ad;border-radius:50%;background:#4a405f;color:#f6f0ff;font-size:23px;font-weight:750;box-shadow:0 7px 25px #0009;display:grid;place-items:center}.backtotop:hover{background:#62547e}.backtotop[hidden]{display:none}
    @media(max-width:770px){.pager{display:flex;flex-direction:column;align-items:center;gap:14px}.pager .pagesize{justify-self:auto}.pager .pagebuttons{justify-content:center}.backtotop{right:16px;bottom:calc(16px + env(safe-area-inset-bottom))}}
    @media(max-width:770px){
      .listtable tr,.listtable tbody tr:hover{background:var(--panel);border-color:var(--line)}
      .more{border-color:var(--line)}
      .refreshbox{width:100%;align-items:stretch}
      .refreshbox .refreshinfo{text-align:center;max-width:none}
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar"><a class="brand" href="./"><span class="mark">⌁</span><span>Delo<span>Radar</span></span></a><div class="topright"><span class="priv">● Javni pregled</span><a class="smalllink" href="#viri" id="topSources">Viri podatkov ↗</a></div></header>
    <section class="intro"><div><div class="eyebrow">Tvoj pregled slovenskega trga dela</div><h1>Vsa zanimiva dela.<br>Na enem mestu.</h1><p>Poišči priložnosti iz trenutno povezanih virov, jih shrani in označi, kje si že stopil v stik. Prijave in klice opraviš sam, neposredno pri delodajalcu.</p></div><div class="refreshbox"><button id="refresh" class="refresh" type="button">↻ &nbsp; Osveži oglase</button><p class="refreshinfo" id="updated">Zadnji zajem oglasov: —</p></div></section>
    <section class="stats" aria-label="Statistika"><div class="stat highlight"><span class="kicker">Zajeti oglasi</span><span class="n" id="total">—</span><span class="lightdot"></span><span class="foot">v povezanih virih</span></div><div class="stat"><span class="kicker">Povezani viri</span><span class="n" id="sourcesNum">—</span><span class="foot">od 2 začetnih</span></div><div class="stat"><span class="kicker">Shranjeni</span><span class="n" id="savedNum">0</span><span class="foot">v tem brskalniku</span></div><div class="stat"><span class="kicker">Kontaktirani</span><span class="n" id="appliedNum">0</span><span class="foot">označeno ročno</span></div></section>
    <div class="content"><aside class="sidebar"><div class="panel"><div class="filterhead"><div class="sectionlabel">Filtriraj oglase</div><button class="clear" id="clear" type="button">Počisti</button></div><div class="filtergroup"><label for="search">Naziv, podjetje ali kraj</label><input class="field" type="search" id="search" placeholder="npr. električar, Maribor" autocomplete="off"></div><div class="filtergroup"><label for="sourceFilter">Zaposlitveni portal</label><select class="field" id="sourceFilter"><option value="">Vsi povezani</option><option>Optius</option><option>Kariera.si</option></select></div><div class="filtergroup"><label for="place">Lokacija</label><input class="field" id="place" placeholder="Cela Slovenija"></div><div class="filtergroup"><label>Moje oznake</label><label class="checkrow"><input type="checkbox" id="onlySaved"> Samo shranjeni</label><label class="checkrow"><input type="checkbox" id="hideApplied"> Skrij kontaktirane</label></div></div><div class="panel"><div class="sectionlabel">Stanje povezav</div><p id="sourceSummary" class="sourcesummary" role="status">Preverjam povezave …</p><details class="sourcedetails" id="sourceDetails"><summary>Posamezni viri</summary><div id="sourceStatus"><div class="sourceitem"><span class="name">Preverjam vire …</span></div></div></details><div class="srcfooter">Oglasi se posodabljajo približno vsakih 12 ur.</div><button class="cataloglink" id="showCatalog" type="button" aria-controls="viri" aria-expanded="false">Prikaži Careerjet in EURES ↗</button></div></aside>
    <button class="backtotop" id="backToTop" type="button" aria-label="Na vrh strani" title="Na vrh strani" hidden>↑</button>
    <main class="mainpanel"><div class="tablehead"><h2>Aktualna delovna mesta <span class="countsub" id="found">Pridobivam oglase …</span></h2><div class="actions"><select id="sort" class="sortselect" aria-label="Razvrščanje"><option value="new">Najnovejši najprej</option><option value="title">Po nazivu A–Ž</option><option value="source">Po viru</option></select><button class="outline" id="export" type="button">↓ Izvozi CSV</button></div></div><div id="notice" role="status" aria-live="polite"></div><div class="tablewrap"><div id="progress" class="loader"></div><table class="listtable"><thead><tr><th style="width:35%">Delovno mesto</th><th style="width:15%">Lokacija</th><th style="width:14%">Portal</th><th style="width:12%">Objava</th><th style="width:12%">Status</th><th style="width:12%">Oglas</th></tr></thead><tbody id="jobRows"><tr><td colspan="6" class="empty">Povezujem se s portali …</td></tr></tbody></table><div class="more" id="summary">Oglasi so povezave na originalne objave. Preveri veljavnost pred prijavo.</div></div></main></div>
    <section id="viri" class="sourcecatalog"><h2>Še nepovezani viri</h2><p>Za ta iskalnika še nimamo samodejnega izvoza. Povezavi odpreta izvirno iskanje, kjer lahko oglase preveriš ročno.</p><div class="sourcegrid" id="planned"></div></section>
    <footer class="bottom"><span>© DeloRadar · Osebni pregled prostih delovnih mest</span><span>Podatki so informativni · Veljavnost in pogoje preveri na izvornem portalu</span></footer>
  </div>
  <script>
    (function(){
      'use strict';
      var jobs=[], sources=[], planned=[], checkedAt='', state={};
      var key='deloradar-status-v1';
      try {state=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){state={}}
      var $=function(id){return document.getElementById(id)};
      var safe=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
      // Lokalni preizkus lahko uporabi vgrajen posnetek; GitHub Pages bere jobs.json.
      var offline=!!window.__DELORADAR_OFFLINE_DATA__;
      var regionPlaces={
        'Pomurska':['murska sobota','lendava','gornja radgona','ljutomer','beltinci','moravske toplice'],
        'Podravska':['maribor','ptuj','slovenska bistrica','lenart','ormož','ruše','hoče','pesnica','kidričevo'],
        'Koroška':['slovenj gradec','dravograd','ravne na koroškem','prevalje','mežica','radlje ob dravi'],
        'Savinjska':['celje','velenje','žalec','slovenske konjice','šentjur','nazarje','laško','rogaška slatina','šoštanj','zreče'],
        'Zasavska':['trbovlje','zagorje ob savi','hrastnik','litija'],
        'Posavska':['krško','brežice','sevnica','radeče'],
        'Jugovzhodna Slovenija':['novo mesto','trebnje','kočevje','ribnica','črnomelj','metlika','šentjernej','mirna peč'],
        'Osrednjeslovenska':['ljubljana','domžale','kamnik','vrhnika','grosuplje','medvode','logatec','ig','vodice'],
        'Gorenjska':['kranj','škofja loka','jesenice','bled','radovljica','tržič','železniki','bohinj'],
        'Goriška':['nova gorica','ajdovščina','tolmin','idrija','šempeter pri gorici','kobarid'],
        'Obalno-kraška':['koper','izola','piran','sežana','ankaran','portorož','divača'],
        'Primorsko-notranjska':['postojna','ilirska bistrica','cerknica','pivka']
      };
      var sectors=[
        ['Elektrotehnika in energetika',/elektr|elektro|energet|mehatron|avtomatiz|serviser|vzdrževalec elektro|inštalater elektr/i],
        ['IT in telekomunikacije',/programer|razvijal|developer|informat|sistemsk|omrež|podatkov|it podpor|računalniš|software|telekomunik/i],
        ['Proizvodnja in industrija',/proizvod|operater|strojnik|kovinar|varilec|tehnolog|kontrolor kakovosti|cnc|montaž|industrij/i],
        ['Gradbeništvo in obrt',/gradben|zidar|tesar|klepar|mizar|pleskar|vodovodar|gradbišč|hišnik/i],
        ['Logistika in prevoz',/voznik|transport|skladišč|logistik|dostavlj|viličar|kurir|špediter/i],
        ['Trgovina in prodaja',/prodajal|prodajn|trgovin|komercial|blagajni|nabavn|tržnik|pospeševalec prodaje/i],
        ['Gostinstvo in turizem',/kuhar|natakar|gostin|hotelsk|receptor|slaščičar|turistič|strežb|delilec hrane/i],
        ['Zdravstvo in oskrba',/medicinsk|zdravstven|negoval|farmacevt|oskrboval|socialni delavec|fizioterapevt/i],
        ['Pisarna, finance in pravo',/računovod|knjigovod|administr|referent|tajnic|finanč|pravnik|pravna služba|poslovn|kadrovs/i],
        ['Izobraževanje in raziskave',/učitelj|vzgojitelj|profesor|pedagog|raziskoval|predavatelj|inštruktor/i]
      ];
      function regionOf(j){
        var s=(j.location||'').toLocaleLowerCase('sl');
        if(!s)s=(j.title||'').toLocaleLowerCase('sl');
        var names=Object.keys(regionPlaces);
        for(var n=0;n<names.length;n++){
          var region=names[n];
          if(s.includes(region.toLocaleLowerCase('sl'))||regionPlaces[region].some(function(t){return s.includes(t)}))return region;
        }
        return 'Neznana regija';
      }
      function sectorOf(j){
        var t=j.title||'';
        for(var n=0;n<sectors.length;n++)if(sectors[n][1].test(t))return sectors[n][0];
        return 'Drugo / nerazvrščeno';
      }
      function dateValue(s){
        if(!s)return NaN;
        var m=String(s).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
        var d=m?new Date(+m[3],+m[2]-1,+m[1]):new Date(s);
        return d.getTime();
      }
      function makeOptions(id,values,empty){
        var el=$(id),selected=el.value;
        el.innerHTML='<option value="">'+safe(empty)+'</option>'+values.map(function(v){return '<option value="'+safe(v)+'">'+safe(v)+'</option>'}).join('');
        if(values.includes(selected))el.value=selected;
      }
      var filterKey='deloradar-filters-v1',savedFilters={};
      try{savedFilters=JSON.parse(localStorage.getItem(filterKey)||'{}')||{}}catch(e){savedFilters={}}
      var pageSize=[10,25,50,100].includes(Number(savedFilters.values&&savedFilters.values.pageSize))?Number(savedFilters.values.pageSize):50,currentPage=1;
      var multiSelected=savedFilters.multi||{},multiLists={};
      function selectedValues(id){return Array.isArray(multiSelected[id])?multiSelected[id]:[]}
      function persistFilters(){
        var values={};['search','published','deadline','myStatus','sort'].forEach(function(id){values[id]=$(id).value});
        values.pageSize=pageSize;
        values.onlySaved=$('onlySaved').checked;values.hideApplied=$('hideApplied').checked;
        values.groupDuplicates=$('groupDuplicates').checked;
        try{localStorage.setItem(filterKey,JSON.stringify({multi:multiSelected,values:values}))}catch(e){}
      }
      var multiIds=['sourceFilter','region','city','sector','company'];
      function normalizeTerm(value){
        return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sl').trim();
      }
      function facetValue(j,id){
        if(id==='sourceFilter')return j.source||'';
        if(id==='region')return regionOf(j);
        if(id==='city')return j.location||'';
        if(id==='sector')return sectorOf(j);
        if(id==='company')return j.company||'';
        return '';
      }
      function facetValues(j,id){
        return id==='region'&&Array.isArray(j.regions)&&j.regions.length?j.regions:[facetValue(j,id)];
      }
      function facetCounts(id){
        var counts=new Map(),seen=new Set();
        jobs.forEach(function(j){
          if(!matchesJob(j,id))return;
          facetValues(j,id).forEach(function(value){
            var group=groupEnabled()&&groupById.has(j.id)?j.duplicateGroup:j.id;
            var identity=group+'|'+id+'|'+value;
            if(value&&!seen.has(identity)){seen.add(identity);counts.set(value,(counts.get(value)||0)+1)}
          });
        });
        return counts;
      }
      function clearMultiSearch(host){
        var input=host.querySelector('.multi-search');
        if(!input||!input.value)return;
        input.value='';
        host.querySelectorAll('.multi-option').forEach(function(row){row.hidden=false});
      }
      function closeMulti(host){
        host.querySelector('.multi-menu').hidden=true;
        host.querySelector('.multi-trigger').setAttribute('aria-expanded','false');
        clearMultiSearch(host);
      }
      function configureMulti(id,options,emptyText){
        var original=$(id),host=document.getElementById('multi-'+id);
        multiLists[id]={options:Array.from(new Set(options.concat(selectedValues(id)))),empty:emptyText};
        if(!host){
          host=document.createElement('div');host.className='multi';host.id='multi-'+id;
          host.innerHTML='<button type="button" class="multi-trigger" aria-expanded="false"><span></span><span>⌄</span></button><div class="multi-menu" hidden><input class="multi-search" type="search" placeholder="Išči možnost…" aria-label="Išči možnost"><div class="multi-options"></div><div class="multi-actions"><button type="button" data-clear="1">Počisti izbor</button></div></div><div class="multi-chips"></div>';
          original.style.display='none';original.setAttribute('aria-hidden','true');original.after(host);
          host.querySelector('.multi-trigger').addEventListener('click',function(){
            document.querySelectorAll('.multi').forEach(function(other){if(other!==host)closeMulti(other)});
            var menu=host.querySelector('.multi-menu');
            if(menu.hidden){menu.hidden=false;host.querySelector('.multi-trigger').setAttribute('aria-expanded','true');host.querySelector('.multi-search').focus()}
            else closeMulti(host);
          });
          host.querySelector('.multi-search').addEventListener('input',function(){
            var q=normalizeTerm(this.value);
            host.querySelectorAll('.multi-option').forEach(function(row){row.hidden=!normalizeTerm(row.dataset.label).includes(q)});
          });
          host.addEventListener('change',function(e){
            if(!e.target.matches('input[type=checkbox][data-value]'))return;
            var val=e.target.dataset.value,arr=selectedValues(id);
            multiSelected[id]=e.target.checked?Array.from(new Set(arr.concat([val]))):arr.filter(function(x){return x!==val});
            clearMultiSearch(host);persistFilters();render();host.querySelector('.multi-search').focus();
          });
          host.addEventListener('click',function(e){
            var remove=e.target.closest('[data-remove]'),clear=e.target.closest('[data-clear]');
            if(remove){multiSelected[id]=selectedValues(id).filter(function(x){return x!==remove.dataset.remove});persistFilters();render()}
            if(clear){multiSelected[id]=[];closeMulti(host);persistFilters();render()}
          });
          host.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMulti(host);host.querySelector('.multi-trigger').focus()}});
        }
        drawMulti(id);
      }
      function drawMulti(id){
        var host=$('multi-'+id);if(!host)return;
        var counts=facetCounts(id),options=Array.from(counts.keys()).sort(function(a,b){return a.localeCompare(b,'sl')});
        var selected=selectedValues(id);
        host.querySelector('.multi-trigger span:first-child').textContent=selected.length?selected.length+' izbranih':multiLists[id].empty;
        host.querySelector('.multi-options').innerHTML=options.length?options.map(function(v){
          return '<label class="multi-option" data-label="'+safe(v)+'"><span><input type="checkbox" data-value="'+safe(v)+'" '+(selected.includes(v)?'checked':'')+'>'+safe(v)+' <small>('+counts.get(v)+')</small></span></label>';
        }).join(''):'<div class="multi-empty">Za trenutne filtre ni možnosti.</div>';
        host.querySelector('.multi-chips').innerHTML=selected.map(function(v){
          return '<span class="multi-chip">'+safe(v)+'<button type="button" data-remove="'+safe(v)+'" aria-label="Odstrani '+safe(v)+'">×</button></span>';
        }).join('');
        var q=normalizeTerm(host.querySelector('.multi-search').value);
        host.querySelectorAll('.multi-option').forEach(function(row){row.hidden=!normalizeTerm(row.dataset.label).includes(q)});
      }
      function drawAllMultis(){multiIds.forEach(drawMulti)}
      // Filtre zgradimo ločeno, da je obstoječi spletni prikaz še vedno uporaben.
      $('sourceFilter').closest('.filtergroup').insertAdjacentHTML('afterend',[
        '<div class="filterheading">PODROČJE IN LOKACIJA</div>',
        '<div class="filtergroup"><label for="region">Regija Slovenije</label><select class="field" id="region"><option value="">Vse regije</option></select><small>Pri nekaterih oglasih je znana regija, ne pa natančen kraj.</small></div>',
        '<div class="filtergroup"><label for="city">Kraj dela</label><select class="field" id="city"><option value="">Vsi kraji</option></select></div>',
        '<div class="filtergroup"><label for="sector">Poklicno področje</label><select class="field" id="sector"><option value="">Vsa področja</option></select><small>Približna razvrstitev na podlagi naziva oglasa.</small></div>',
        '<div class="filterheading">PODJETJE IN ČAS</div>',
        '<div class="filtergroup"><label for="company">Delodajalec</label><select class="field" id="company"><option value="">Vsi delodajalci</option></select></div>',
        '<div class="filtergroup"><label for="published">Datum objave</label><select class="field" id="published"><option value="">Kadar koli</option><option value="3">Zadnje 3 dni</option><option value="7">Zadnjih 7 dni</option><option value="30">Zadnjih 30 dni</option><option value="unknown">Datum ni naveden</option></select></div>',
        '<div class="filtergroup"><label for="deadline">Rok prijave</label><select class="field" id="deadline"><option value="">Kateri koli</option><option value="7">V naslednjih 7 dneh</option><option value="14">V naslednjih 14 dneh</option><option value="unknown">Rok ni naveden</option></select></div>',
        '<div class="filtergroup"><label for="myStatus">Moj status</label><select class="field" id="myStatus"><option value="">Vsi statusi</option><option value="none">Neoznačeni</option><option value="interested">Zanimivo</option><option value="contacted">Kontaktirano</option></select></div>'
      ].join(''));
      $('place').closest('.filtergroup').remove();
      $('onlySaved').closest('.filtergroup').insertAdjacentHTML('afterend','<div class="filtergroup"><label>Prikaz</label><label class="checkrow"><input type="checkbox" id="groupDuplicates" checked> Združi verjetne dvojnike</label><small>Izvorni oglasi in njihove povezave ostanejo na voljo.</small></div>');
      configureMulti('sourceFilter',['Optius','Kariera.si'],'Vsi portali');
      configureMulti('region',Object.keys(regionPlaces).concat(['Neznana regija']),'Vse regije');
      configureMulti('sector',sectors.map(function(x){return x[0]}).concat(['Drugo / nerazvrščeno']),'Vsa področja');
      configureMulti('city',[],'Vsi kraji');
      configureMulti('company',[],'Vsi delodajalci');
      var restored=savedFilters.values||{};
      ['search','published','deadline','myStatus','sort'].forEach(function(id){if(restored[id]!==undefined)$(id).value=restored[id]});
      if(restored.onlySaved!==undefined)$('onlySaved').checked=!!restored.onlySaved;
      if(restored.hideApplied!==undefined)$('hideApplied').checked=!!restored.hideApplied;
      if(restored.groupDuplicates!==undefined)$('groupDuplicates').checked=!!restored.groupDuplicates;
      document.addEventListener('click',function(e){
        if(!e.target.closest('.multi'))document.querySelectorAll('.multi').forEach(closeMulti);
      });
      if(offline){
        document.querySelector('.eyebrow').textContent='Lokalni test · verzija pred objavo';
        document.querySelector('.intro h1').textContent='Preglej. Filtriraj. Izberi.';
        document.querySelector('.srcfooter').textContent='To je lokalni preizkus z vgrajenim posnetkom oglasov. Pridobivanje novih oglasov še ni omogočeno.';
        $('refresh').textContent='↻ Preberi testni posnetek';
        $('refresh').title='Lokalni ZIP se brez novega paketa ne osvežuje';
      }else{
        document.querySelector('.srcfooter').textContent='Oglasi se posodabljajo približno vsakih 12 ur.';
        var manualLink=document.createElement('a');manualLink.className='refresh';
        manualLink.href='https://github.com/machinefhead/deloradar-si/actions/workflows/pages.yml';
        manualLink.target='_blank';manualLink.rel='noopener noreferrer';manualLink.textContent='↻ Osveži';
        manualLink.title='Odpri GitHub Actions in izberi Run workflow za nov zajem oglasov.';
        $('refresh').replaceWith(manualLink);
      }
      function getState(id){return state[id]||{}}
      var duplicateGroups=new Map(),groupById=new Map();
      function groupEnabled(){return $('groupDuplicates').checked}
      function indexDuplicateGroups(){
        duplicateGroups=new Map();groupById=new Map();
        jobs.forEach(function(j){if(!j.duplicateGroup)return;var members=duplicateGroups.get(j.duplicateGroup)||[];members.push(j);duplicateGroups.set(j.duplicateGroup,members)});
        duplicateGroups.forEach(function(members){if(members.length===2)members.forEach(function(j){groupById.set(j.id,members)})});
      }
      function memberIds(j){
        var group=groupEnabled()&&groupById.get(j.id);
        return group?group.map(function(x){return x.id}):[j.id];
      }
      function mergedState(j){
        var states=memberIds(j).map(getState);
        return {saved:states.some(function(s){return !!s.saved}),status:states.some(function(s){return s.status==='contacted'})?'contacted':states.some(function(s){return s.status==='interested'})?'interested':''};
      }
      function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch(e){} updateStats()}
      function updateStats(){
        var seen=new Set(),saved=0,contacted=0;
        Object.keys(state).forEach(function(id){
          var group=groupEnabled()&&groupById.get(id),identity=group?group[0].duplicateGroup:id;
          if(seen.has(identity))return;seen.add(identity);
          var entries=group?group.map(function(j){return getState(j.id)}):[getState(id)];
          if(entries.some(function(s){return !!s.saved}))saved++;
          if(entries.some(function(s){return s.status==='contacted'}))contacted++;
        });
        $('savedNum').textContent=saved;$('appliedNum').textContent=contacted;
      }
      function dateLabel(s){if(!s)return '—';var d=new Date(s);return isNaN(d.getTime())?'—':new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'short',year:'numeric'}).format(d)}
      function sourceRender(){
        $('sourceStatus').innerHTML=sources.slice().sort(function(a,b){return b.count-a.count||a.name.localeCompare(b.name,'sl')}).map(function(s){return '<div class="sourceitem"><span class="name">'+safe(s.name)+'</span><span class="pill '+(s.status!=='live'?'err':'')+'">'+(s.status==='live'?s.count+' oglasov':'Ni odziva')+'</span></div>'}).join('');
        var active=sources.filter(function(s){return s.status==='live'}).length;
        $('sourceSummary').textContent=active+' od '+sources.length+' virov dosegljivih';
        $('sourcesNum').textContent=active;
        document.querySelector('.stats .stat:nth-child(2) .foot').textContent='od '+sources.length+' povezanih';
        $('planned').innerHTML=planned.map(function(s){return '<div class="sourcecard"><a target="_blank" rel="noopener noreferrer" href="'+safe(s.href)+'">'+safe(s.name)+' ↗</a><p>'+safe(s.note)+'</p></div>'}).join('');
        var broken=sources.filter(function(s){return s.status!=='live'});
        $('notice').innerHTML=broken.length?'<div class="notice">Pozor: '+broken.map(function(x){return safe(x.name)}).join(', ')+' trenutno ni dosegljiv. Spodaj so samo uspešno pridobljeni oglasi.</div>':'';
      }
      function matchesJob(j,exceptFacet){
        var q=normalizeTerm($('search').value);
        var only=$('onlySaved').checked,hide=$('hideApplied').checked;
        var pub=$('published').value,deadline=$('deadline').value,myStatus=$('myStatus').value;
        var current=Date.now(),day=86400000;
        var st=mergedState(j),published=dateValue(j.date),due=dateValue(j.deadline);
        var statusMatch=!myStatus||(myStatus==='none'?!st.status:st.status===myStatus);
        var pubMatch=!pub||(pub==='unknown'?!Number.isFinite(published):(Number.isFinite(published)&&published>=current-(+pub)*day));
        var deadlineMatch=!deadline||(deadline==='unknown'?!Number.isFinite(due):(Number.isFinite(due)&&due>=current-day&&due<=current+(+deadline)*day));
        return (!q||normalizeTerm([j.title,j.company,j.location].join(' ')).includes(q))&&
          (!only||st.saved)&&(!hide||st.status!=='contacted')&&
          multiIds.every(function(id){var values=selectedValues(id);return id===exceptFacet||!values.length||facetValues(j,id).some(function(v){return values.includes(v)})})&&
          statusMatch&&pubMatch&&deadlineMatch;
      }
      function filtered(){
        var result=jobs.filter(function(j){return matchesJob(j)});
        var sort=$('sort').value;result.sort(function(a,b){if(sort==='title')return a.title.localeCompare(b.title,'sl');if(sort==='source')return a.source.localeCompare(b.source,'sl');return (b.date||'').localeCompare(a.date||'')||a.title.localeCompare(b.title,'sl')});return result;
      }
      function displayed(raw){
        raw=raw||filtered();if(!groupEnabled())return raw;
        var selected=new Map();
        raw.forEach(function(j){
          var key=groupById.has(j.id)?j.duplicateGroup:j.id,previous=selected.get(key);
          if(!previous){selected.set(key,j);return}
          // Če je na voljo neposredna stran oglasa, ima prednost pred iskalno povezavo.
          if(/\/iskanje-zaposlitve\?/.test(previous.url)&&!/\/iskanje-zaposlitve\?/.test(j.url))selected.set(key,j);
        });
        return Array.from(selected.values()).map(function(j){
          var members=groupById.get(j.id);
          return members?Object.assign({},j,{alternatives:members.filter(function(x){return x.id!==j.id})}):j;
        });
      }
      var pager=document.createElement('nav');pager.id='pager';pager.className='pager';pager.setAttribute('aria-label','Strani oglasov');$('summary').after(pager);
      function pageButton(number,label,totalPages,active){
        var disabled=number<1||number>totalPages;
        var aria=label==='‹'?'Prejšnja stran':label==='›'?'Naslednja stran':(active?'Trenutna stran ':'Stran ')+number;
        return '<button type="button" data-page="'+number+'" '+(disabled?'disabled ':'')+(active?'aria-current="page" ':'')+'aria-label="'+aria+'">'+label+'</button>';
      }
      function pageNavigation(totalPages){
        var shown=new Set([1,totalPages]);
        for(var n=currentPage-2;n<=currentPage+2;n++)if(n>=1&&n<=totalPages)shown.add(n);
        var numbers=Array.from(shown).sort(function(a,b){return a-b}),last=0;
        var buttons=pageButton(currentPage-1,'‹',totalPages,false);
        numbers.forEach(function(n){
          if(n-last>1)buttons+='<span class="gapdots" aria-hidden="true">…</span>';
          buttons+=pageButton(n,String(n),totalPages,n===currentPage);last=n;
        });
        buttons+=pageButton(currentPage+1,'›',totalPages,false);
        pager.innerHTML='<div class="pagebuttons">'+buttons+'</div><label class="pagesize" for="pageSize">Oglasov na stran <select id="pageSize" aria-label="Oglasov na stran"><option value="10" '+(pageSize===10?'selected':'')+'>10</option><option value="25" '+(pageSize===25?'selected':'')+'>25</option><option value="50" '+(pageSize===50?'selected':'')+'>50</option><option value="100" '+(pageSize===100?'selected':'')+'>100</option></select></label>';
      }
      function render(keepPage){
        var raw=filtered(),items=displayed(raw),joined=raw.length-items.length;
        $('found').textContent='· '+items.length+' razpisov'+(joined?' · '+joined+' združenih objav':'');
        $('total').textContent=jobs.length.toLocaleString('sl-SI');
        drawAllMultis();
        if(!keepPage)currentPage=1;
        var totalPages=Math.max(1,Math.ceil(items.length/pageSize));currentPage=Math.min(currentPage,totalPages);
        var start=(currentPage-1)*pageSize,end=Math.min(start+pageSize,items.length);
        if(!items.length){$('summary').textContent='Ni zadetkov za izbrane filtre.';pager.innerHTML='';$('jobRows').innerHTML='<tr><td colspan="6"><div class="empty"><div class="big">⌕</div><h3>Ni zadetkov</h3><p>'+(jobs.length?'Poskusi drug naziv ali počisti filtre.':'Trenutno ni mogoče prikazati oglasov. Poskusi osvežiti stran pozneje.')+'</p></div></td></tr>';return}
        $('jobRows').innerHTML=items.slice(start,end).map(function(j){
          var s=mergedState(j);
          var location=j.location||(Array.isArray(j.regions)&&j.regions.length?(j.regions.length===1?j.regions[0]+' (regija)':'Več regij ('+j.regions.length+')'):'Ni navedeno');
          var alternatives=j.alternatives&&j.alternatives.length?'<div class="jobalternatives">Objavljeno tudi na: '+j.alternatives.map(function(other){return '<a href="'+safe(other.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Odpri isti razpis na '+safe(other.source)+'">'+safe(other.source)+' ↗</a>'}).join(' · ')+'</div>':'';
          return '<tr><td><a target="_blank" rel="noopener noreferrer" class="jobtitle" href="'+safe(j.url)+'">'+safe(j.title)+'</a><div class="jobcompany">'+safe(j.company||'Oglej si delodajalca na portalu')+'</div>'+(j.reference?'<div class="jobcompany">ZRSZ oznaka: '+safe(j.reference)+'</div>':'')+alternatives+'</td><td class="muted">'+safe(location)+'</td><td><span class="srcbadge '+(j.source==='Kariera.si'?'kariera':'')+'">'+safe(j.source)+'</span></td><td class="dead">'+dateLabel(j.date)+'</td><td><select class="state '+(s.status==='contacted'?'applied':s.status==='interested'?'saved':'')+'" data-status="'+safe(j.id)+'" aria-label="Status: '+safe(j.title)+'"><option value="" '+(!s.status?'selected':'')+'>Ni označeno</option><option value="interested" '+(s.status==='interested'?'selected':'')+'>Zanimivo</option><option value="contacted" '+(s.status==='contacted'?'selected':'')+'>Kontaktirano</option></select></td><td><div class="rowactions"><button class="star '+(s.saved?'active':'')+'" data-star="'+safe(j.id)+'" title="Shrani oglas" aria-label="Shrani oglas" type="button">'+(s.saved?'★':'☆')+'</button><a class="openjob" href="'+safe(j.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+(j.reference?'Odpri iskalnik ZRSZ':'Odpri oglas')+'">↗</a></div></td></tr>';
        }).join('');
        $('summary').textContent='Prikazanih '+(start+1)+'–'+end+' od '+items.length+' razpisov · Stran '+currentPage+' od '+totalPages+' · Rok in pogoje preveri na izvornem portalu.';
        pageNavigation(totalPages);
      }
      function noticeMessage(txt){$('notice').innerHTML='<div class="notice">'+safe(txt)+'</div>'}
      function load(){
        if(offline){$('refresh').disabled=true;$('refresh').textContent='↻   Nalagam posnetek …'}
        $('progress').style.display='block';
        (offline?Promise.resolve(window.__DELORADAR_OFFLINE_DATA__):fetch((window.__DELORADAR_DATA_URL__||'./jobs.json')+'?v='+Date.now(),{cache:'no-store',headers:{accept:'application/json'}}).then(function(r){if(!r.ok)throw Error('Strežnik ni dosegljiv');return r.json()})).then(function(data){
          jobs=data.jobs||[];sources=data.sources||[];planned=data.planned||[];checkedAt=data.checkedAt||'';
          indexDuplicateGroups();updateStats();
          configureMulti('sourceFilter',sources.map(function(s){return s.name}),'Vsi portali');
          configureMulti('city',Array.from(new Set(jobs.map(function(j){return j.location}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'sl')}),'Vsi kraji');
          configureMulti('company',Array.from(new Set(jobs.map(function(j){return j.company}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'sl')}),'Vsi delodajalci');
          sourceRender();render();
          if(offline){
            noticeMessage('LOKALNI PREIZKUS: Posnetek resničnih oglasov. Ni samodejnega osveževanja; za aktualne oglase preveri povezave pri izvornih portalih.');
            $('updated').textContent='Posnetek zbran: '+(checkedAt?new Intl.DateTimeFormat('sl-SI',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Ljubljana'}).format(new Date(checkedAt)):'—')+'. Kategorije so ocenjene iz nazivov; neznane regije so označene.';
          }else{
            $('updated').textContent='Zadnji zajem oglasov: '+(checkedAt?new Intl.DateTimeFormat('sl-SI',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Ljubljana'}).format(new Date(checkedAt)):'—');
          }
        }).catch(function(){noticeMessage('Oglasov trenutno ni mogoče pridobiti. Preveri povezavo in poskusi znova.');$('jobRows').innerHTML='<tr><td colspan="6" class="empty">Napaka pri pridobivanju podatkov.</td></tr>'}).finally(function(){$('progress').style.display='none';if(offline){$('refresh').disabled=false;$('refresh').textContent='↻   Preberi testni posnetek'}});
      }
      ['search'].forEach(function(id){$(id).addEventListener('input',render)});
      ['sourceFilter','onlySaved','hideApplied','sort'].forEach(function(id){$(id).addEventListener('change',render)});
      $('groupDuplicates').addEventListener('change',function(){persistFilters();updateStats();render()});
      ['region','city','sector','company','published','deadline','myStatus'].forEach(function(id){$(id).addEventListener('change',render)});
      $('clear').addEventListener('click',function(){
        ['search','published','deadline','myStatus'].forEach(function(id){$(id).value=''});
        multiIds.forEach(function(id){multiSelected[id]=[]});
        $('onlySaved').checked=false;$('hideApplied').checked=false;persistFilters();render()
      });
      ['search'].forEach(function(id){$(id).addEventListener('input',persistFilters)});
      ['published','deadline','myStatus','sort','onlySaved','hideApplied'].forEach(function(id){$(id).addEventListener('change',persistFilters)});
      if(offline)$('refresh').addEventListener('click',load);
      pager.addEventListener('click',function(e){var b=e.target.closest('[data-page]');if(!b||b.disabled)return;currentPage=Number(b.dataset.page);render(true);$('jobRows').scrollIntoView({behavior:'smooth',block:'start'})});
      pager.addEventListener('change',function(e){if(e.target.id!=='pageSize')return;pageSize=Number(e.target.value);persistFilters();render()});
      var backToTop=$('backToTop');
      function updateBackToTop(){backToTop.hidden=window.scrollY<400}
      window.addEventListener('scroll',updateBackToTop,{passive:true});
      backToTop.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
      updateBackToTop();
      function changeMemberStates(id,field,value){
        var members=groupEnabled()&&groupById.get(id),ids=members?members.map(function(j){return j.id}):[id];
        ids.forEach(function(member){state[member]=Object.assign({},getState(member),{[field]:value})});
      }
      $('jobRows').addEventListener('click',function(e){var b=e.target.closest('[data-star]');if(!b)return;var id=b.dataset.star;changeMemberStates(id,'saved',!mergedState({id:id}).saved);save();render(true)});
      $('jobRows').addEventListener('change',function(e){var b=e.target.closest('[data-status]');if(!b)return;changeMemberStates(b.dataset.status,'status',b.value);save();render(true)});
      function showSources(){var el=$('viri'),open=el.classList.toggle('show');$('showCatalog').textContent=open?'Skrij Careerjet in EURES ↑':'Prikaži Careerjet in EURES ↗';$('showCatalog').setAttribute('aria-expanded',String(open));if(open)el.scrollIntoView({behavior:'smooth',block:'start'})}
      $('showCatalog').addEventListener('click',showSources);$('topSources').addEventListener('click',function(e){e.preventDefault();showSources()});
      $('export').addEventListener('click',function(){
        var quote=function(s){return '"'+String(s==null?'':s).replace(/"/g,'""')+'"'};
        var rows=[['Naziv','Podjetje','Kraj','Portal','Objava','Povezava','Druge izvorne povezave','Status','Shranjeno']].concat(displayed().map(function(j){var s=mergedState(j);return [j.title,j.company,j.location,j.source,j.date,j.url,(j.alternatives||[]).map(function(x){return x.source+': '+x.url}).join(' | '),s.status||'',s.saved?'Da':'Ne']}));
        var csv='\uFEFF'+rows.map(function(r){return r.map(quote).join(';')}).join('\r\n');
        var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='deloradar-oglasi.csv';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
      });
      var mobileToggle=document.createElement('button');
      mobileToggle.type='button';mobileToggle.className='mobilefilters';mobileToggle.setAttribute('aria-expanded','false');
      mobileToggle.textContent='☷  Prikaži filtre';
      var sidebar=document.querySelector('.sidebar');sidebar.prepend(mobileToggle);
      mobileToggle.addEventListener('click',function(){
        var open=sidebar.classList.toggle('filters-open');
        mobileToggle.setAttribute('aria-expanded',String(open));
        mobileToggle.textContent=open?'☷  Skrij filtre':'☷  Prikaži filtre';
      });
      var sourcesToggle=document.createElement('button');
      sourcesToggle.type='button';sourcesToggle.className='mobilefilters';sourcesToggle.setAttribute('aria-expanded','false');
      sourcesToggle.textContent='◉  Stanje povezav in viri';
      sidebar.querySelectorAll('.panel')[1].before(sourcesToggle);
      sourcesToggle.addEventListener('click',function(){
        var open=sidebar.classList.toggle('sources-open');
        sourcesToggle.setAttribute('aria-expanded',String(open));
        sourcesToggle.textContent=open?'◉  Skrij stanje povezav':'◉  Stanje povezav in viri';
      });
      updateStats();load();
    })();
  </script>
</body>
</html>`;
