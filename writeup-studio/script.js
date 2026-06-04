const page = document.body.dataset.page;
const libraryKey = "solution-blog-library-v1";
const oldLibraryKey = "contest-writeup-studio-library-v1";
const legacyDraftKey = "contest-writeup-studio-draft";
const dataFile = "./data.json";

let library = emptyLibrary();
let librarySource = "empty";
let activeEditor = null;
let savedRange = null;
let activeBold = false;
let activeSize = null;
let activeColor = null;

const sizeConfig = {
    small: { command: "2", px: "0.8125rem" },
    normal: { command: "4", px: "1.125rem" },
    large: { command: "6", px: "1.875rem" }
};

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function emptyLibrary() {
    return { platforms: [], contests: [], activePlatformId: null, activeContestId: null, activeSolutionId: null };
}

function emptyProblemDescription() {
    return "";
}

function emptySolutionDescription() {
    return "";
}

function blankSolution(title = "Untitled Solution", url = "") {
    const now = new Date().toISOString();
    return {
        id: makeId("solution"),
        title,
        url,
        problemDescription: emptyProblemDescription(),
        solutionDescription: emptySolutionDescription(),
        code: "",
        createdAt: now,
        updatedAt: now
    };
}

function blankPlatform(name = "Untitled Platform", url = "") {
    const now = new Date().toISOString();
    return {
        id: makeId("platform"),
        name,
        url,
        createdAt: now,
        updatedAt: now
    };
}

function normalizeSolution(solution) {
    solution.problemDescription ||= emptyProblemDescription();
    solution.solutionDescription ||= solution.description || emptySolutionDescription();
    solution.code ||= "";
    solution.url ||= "";
    solution.title ||= "Untitled Solution";
    return solution;
}

function normalizeLibrary(value) {
    if(!value) {
        return emptyLibrary();
    }

    value.platforms ||= [];
    value.contests ||= [];

    if(value.platforms.length === 0 && value.contests.length > 0) {
        const platform = blankPlatform("Imported Contests", "");
        value.platforms.push(platform);
        value.activePlatformId ||= platform.id;
        value.contests.forEach((contest) => {
            contest.platformId ||= platform.id;
        });
    }

    value.contests.forEach((contest) => {
        if(!contest.platformId && value.platforms[0]) contest.platformId = value.platforms[0].id;
        contest.solutions ||= [];
        contest.solutions.forEach(normalizeSolution);
    });
    return value;
}

function activePlatform() {
    return library.platforms.find((platform) => platform.id === library.activePlatformId) || null;
}

function contestsForPlatform(platformId = library.activePlatformId) {
    return library.contests.filter((contest) => contest.platformId === platformId);
}

function activeContest() {
    return library.contests.find((contest) => contest.id === library.activeContestId) || null;
}

function activeSolution() {
    const contest = activeContest();
    if(!contest) return null;
    return contest.solutions.find((solution) => solution.id === library.activeSolutionId) || null;
}

function repairActivePointers() {
    if(!activePlatform() && library.platforms.length) {
        library.activePlatformId = library.platforms[0].id;
    }

    if(library.activeContestId) {
        const contest = activeContest();
        if(contest) library.activePlatformId = contest.platformId || library.activePlatformId;
    }

    const platform = activePlatform();
    if(!platform) {
        library.activePlatformId = null;
        library.activeContestId = null;
        library.activeSolutionId = null;
        return;
    }

    const platformContests = contestsForPlatform(platform.id);
    const contest = activeContest();
    if(!contest || contest.platformId !== platform.id) {
        library.activeContestId = platformContests[0]?.id || null;
    }

    const fixedContest = activeContest();
    if(!fixedContest) {
        library.activeSolutionId = null;
        return;
    }

    if(!activeSolution() && fixedContest.solutions.length) {
        library.activeSolutionId = fixedContest.solutions[0].id;
    }
    if(fixedContest.solutions.length === 0) {
        library.activeSolutionId = null;
    }
}

function saveLibrary() {
    repairActivePointers();
    localStorage.setItem(libraryKey, JSON.stringify(library));
    librarySource = "localStorage";
}

async function loadPublishedLibrary() {
    try {
        const response = await fetch(dataFile, { cache: "no-store" });
        if(!response.ok) return null;
        return normalizeLibrary(await response.json());
    }
    catch {
        return null;
    }
}

async function loadLibrary() {
    const raw = localStorage.getItem(libraryKey) || localStorage.getItem(oldLibraryKey);
    if(raw) {
        try {
            library = normalizeLibrary(JSON.parse(raw));
            librarySource = "localStorage";
            saveLibrary();
            return;
        }
        catch {
            library = emptyLibrary();
            librarySource = "empty";
        }
    }

    const oldDraft = localStorage.getItem(legacyDraftKey);
    if(oldDraft) {
        try {
            const draft = JSON.parse(oldDraft);
            const solution = blankSolution(draft.title || "Imported Draft", draft.url || "");
            solution.solutionDescription = draft.description || emptySolutionDescription();
            solution.code = draft.code || "";
            const platform = blankPlatform("Imported Contests", "");
            const contestId = makeId("contest");
            library = {
                platforms: [platform],
                contests: [{ id: contestId, platformId: platform.id, name: "Imported Drafts", url: "", solutions: [solution] }],
                activePlatformId: platform.id,
                activeContestId: contestId,
                activeSolutionId: solution.id
            };
            librarySource = "localStorage";
            saveLibrary();
            return;
        }
        catch {
            library = emptyLibrary();
            librarySource = "empty";
        }
    }

    const published = await loadPublishedLibrary();
    if(published) {
        library = published;
        librarySource = "data.json";
        repairActivePointers();
        return;
    }

    repairActivePointers();
}

function getQuery() {
    return new URLSearchParams(window.location.search);
}

function setActiveFromQuery() {
    const params = getQuery();
    const platformId = params.get("platform");
    const contestId = params.get("contest");
    const solutionId = params.get("solution");
    if(platformId) library.activePlatformId = platformId;
    if(contestId) library.activeContestId = contestId;
    if(contestId && !platformId) {
        const contest = library.contests.find((item) => item.id === contestId);
        if(contest) library.activePlatformId = contest.platformId;
    }
    if(solutionId) library.activeSolutionId = solutionId;
    repairActivePointers();
}

function platformUrl(platformId) {
    return `./platform.html?platform=${encodeURIComponent(platformId)}`;
}

function contestUrl(platformId, contestId) {
    return `./contest.html?platform=${encodeURIComponent(platformId)}&contest=${encodeURIComponent(contestId)}`;
}

function solutionUrl(platformId, contestId, solutionId) {
    return `./solution.html?platform=${encodeURIComponent(platformId)}&contest=${encodeURIComponent(contestId)}&solution=${encodeURIComponent(solutionId)}`;
}

function editSolutionUrl(platformId, contestId, solutionId) {
    return `${solutionUrl(platformId, contestId, solutionId)}&edit=1`;
}

function isEditMode() {
    return getQuery().get("edit") === "1";
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function plainTextFromHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function richHtmlIsEmpty(html) {
    const text = plainTextFromHtml(html);
    return !text
        || text === "Paste or summarize the problem statement here."
        || text === "Write the intuition, proof idea, transitions, and implementation details here.";
}

function editorIsEmpty(editor) {
    return !editor || richHtmlIsEmpty(editor.innerHTML);
}

function slug(text) {
    return (text || "solution")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function highlightCpp(code) {
    const placeholders = [];

    function hold(className, text) {
        const id = placeholders.length;
        let x = id;
        let name = "";
        do {
            name = String.fromCharCode(65 + (x % 26)) + name;
            x = Math.floor(x / 26) - 1;
        } while(x >= 0);

        const key = `@@PH${name}@@`;
        placeholders.push([key, `<span class="${className}">${escapeHtml(text)}</span>`]);
        return key;
    }

    let out = String(code || "")
        .replace(/^#.*$/gm, (m) => hold("tok-pre", m))
        .replace(/\/\/.*$/gm, (m) => hold("tok-comment", m))
        .replace(/\/\*[\s\S]*?\*\//g, (m) => hold("tok-comment", m))
        .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (m) => hold("tok-string", m));

    out = escapeHtml(out);

    const types = new Set(["long long", "int", "char", "bool", "double", "float", "void", "string", "vector", "array", "map", "set", "multiset", "unordered_map", "unordered_set", "queue", "deque", "stack", "pair", "auto"]);
    const keywords = new Set(["if", "else", "for", "while", "return", "break", "continue", "switch", "case", "default", "class", "struct", "public", "private", "protected", "const", "static", "using", "namespace", "template", "typename"]);
    const token = /\b(long long|unordered_map|unordered_set|multiset|vector|array|string|double|float|bool|char|void|auto|pair|queue|deque|stack|map|set|int|if|else|for|while|return|break|continue|switch|case|default|class|struct|public|private|protected|const|static|using|namespace|template|typename|\d+LL|\d+)\b/g;

    out = out.replace(token, (word) => {
        if(types.has(word)) return `<span class="tok-type">${word}</span>`;
        if(keywords.has(word)) return `<span class="tok-keyword">${word}</span>`;
        return `<span class="tok-number">${word}</span>`;
    });

    for(const [key, html] of placeholders) {
        out = out.replaceAll(key, html);
    }
    return out;
}

function normalizeFontTags(root) {
    root.querySelectorAll("font[size]").forEach((node) => {
        const raw = node.getAttribute("size");
        const size = raw === "2" ? "small" : raw === "6" ? "large" : "normal";
        const span = document.createElement("span");
        span.dataset.size = size;
        span.style.fontSize = sizeConfig[size].px;
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
    });
}

function stripPastedPaint(root) {
    root.querySelectorAll("style, script, link, meta").forEach((node) => node.remove());

    root.querySelectorAll("*").forEach((node) => {
        node.removeAttribute("bgcolor");
        node.removeAttribute("background");
        node.removeAttribute("color");
        node.removeAttribute("class");
        node.removeAttribute("id");

        if(node.hasAttribute("style")) {
            ["background", "background-color", "background-image", "color", "-webkit-text-fill-color", "text-shadow", "box-shadow"].forEach((property) => {
                node.style.removeProperty(property);
            });

            if(!node.getAttribute("style").trim()) {
                node.removeAttribute("style");
            }
        }
    });
}

function stripPastedLayout(root) {
    root.querySelectorAll("style, script, link, meta").forEach((node) => node.remove());

    root.querySelectorAll("*").forEach((node) => {
        node.removeAttribute("class");
        node.removeAttribute("id");
        node.removeAttribute("width");
        node.removeAttribute("height");
        node.removeAttribute("align");

        if(node.hasAttribute("style")) {
            ["display", "width", "max-width", "min-width", "height", "max-height", "min-height", "margin-left", "margin-right", "float", "position", "left", "right", "transform", "overflow", "overflow-x"].forEach((property) => {
                node.style.removeProperty(property);
            });

            if(!node.getAttribute("style").trim()) {
                node.removeAttribute("style");
            }
        }
    });
}

function forceSolutionWidth(root) {
    if(!root) return;

    root.style.display = "block";
    root.style.width = "100%";
    root.style.maxWidth = "none";

    const wideTags = new Set(["DIV", "P", "SECTION", "ARTICLE", "BLOCKQUOTE", "PRE", "UL", "OL", "TABLE"]);
    root.querySelectorAll("*").forEach((node) => {
        node.removeAttribute("width");
        node.removeAttribute("align");

        if(node.hasAttribute("style")) {
            ["width", "max-width", "min-width", "margin-left", "margin-right", "float", "position", "left", "right", "transform", "overflow", "overflow-x"].forEach((property) => {
                node.style.removeProperty(property);
            });
        }

        if(wideTags.has(node.tagName)) {
            node.style.display = node.tagName === "TABLE" ? "table" : "block";
            node.style.width = "100%";
            node.style.maxWidth = "none";
            node.style.marginLeft = "0";
            node.style.marginRight = "0";
        }
    });
}

function htmlFromPlainText(text) {
    return escapeHtml(text)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split(/\n{2,}/)
        .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function sanitizeProblemPaste(event) {
    event.preventDefault();
    activeEditor = $("#problemDescription");

    const clipboard = event.clipboardData || window.clipboardData;
    const html = clipboard?.getData("text/html") || "";
    const text = clipboard?.getData("text/plain") || "";
    const wrap = document.createElement("div");

    if(html) wrap.innerHTML = html;
    else wrap.innerHTML = htmlFromPlainText(text);

    stripPastedPaint(wrap);
    document.execCommand("insertHTML", false, wrap.innerHTML);
    saveSelection();
    updateToolbarState();
    updatePreview();
}

function sanitizeSolutionPaste(event) {
    event.preventDefault();
    activeEditor = $("#solutionDescription");

    const clipboard = event.clipboardData || window.clipboardData;
    const html = clipboard?.getData("text/html") || "";
    const text = clipboard?.getData("text/plain") || "";
    const wrap = document.createElement("div");

    if(html) wrap.innerHTML = html;
    else wrap.innerHTML = htmlFromPlainText(text);

    stripPastedLayout(wrap);
    normalizeFontTags(wrap);
    document.execCommand("insertHTML", false, wrap.innerHTML);
    saveSelection();
    updateToolbarState();
    updatePreview();
}

function highlightCodeBlocks(root) {
    root.querySelectorAll("pre").forEach((pre) => {
        const text = pre.textContent;
        pre.innerHTML = `<code class="language-cpp">${highlightCpp(text)}</code>`;
    });
}

function renderRichEditor(editor) {
    if(!editor) return "";
    if(editorIsEmpty(editor)) return "";
    const rawText = editor.innerText;
    if(!rawText.includes("```")) {
        const wrap = document.createElement("div");
        wrap.innerHTML = editor.innerHTML;
        if(editor.id === "problemDescription") stripPastedPaint(wrap);
        stripPastedLayout(wrap);
        normalizeFontTags(wrap);
        highlightCodeBlocks(wrap);
        return wrap.innerHTML;
    }

    const lines = rawText.split(/\r?\n/);
    const chunks = [];
    let inCode = false;
    let code = [];
    let text = [];

    function flushText() {
        const value = text.join("\n").trim();
        if(value) {
            chunks.push(value
                .split(/\n{2,}/)
                .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
                .join(""));
        }
        text = [];
    }

    function flushCode() {
        chunks.push(`<pre><code class="language-cpp">${highlightCpp(code.join("\n"))}</code></pre>`);
        code = [];
    }

    for(const line of lines) {
        if(line.trim().startsWith("```")) {
            if(inCode) {
                flushCode();
                inCode = false;
            }
            else {
                flushText();
                inCode = true;
            }
            continue;
        }
        if(inCode) code.push(line);
        else text.push(line);
    }

    if(inCode) flushCode();
    flushText();
    return chunks.join("");
}

function editorContaining(node) {
    return $all("[data-rich-editor]").find((editor) => node === editor || editor.contains(node)) || null;
}

function focusDoc() {
    activeEditor ||= $("[data-rich-editor]");
    activeEditor?.focus();
}

function currentSelectionInfo() {
    const sel = window.getSelection();
    if(!sel || !sel.rangeCount) return { inside: false, selected: false };

    const range = sel.getRangeAt(0);
    const editor = editorContaining(range.commonAncestorContainer);
    if(editor) activeEditor = editor;
    return { inside: !!editor, selected: !!editor && !sel.isCollapsed, range, editor };
}

function saveSelection() {
    const info = currentSelectionInfo();
    if(info.inside) savedRange = info.range.cloneRange();
}

function restoreSelection() {
    focusDoc();
    if(!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
}

function setSelectionRange(range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
    const editor = editorContaining(range.commonAncestorContainer);
    if(editor) activeEditor = editor;
}

function closestInsideEditor(node, tagName) {
    while(node && node !== activeEditor) {
        if(node.nodeType === Node.ELEMENT_NODE && node.tagName === tagName) return node;
        node = node.parentNode;
    }
    return null;
}

function closestBlock(node) {
    const names = new Set(["P", "DIV", "LI", "PRE"]);
    while(node && node !== activeEditor) {
        if(node.nodeType === Node.ELEMENT_NODE && names.has(node.tagName)) return node;
        node = node.parentNode;
    }
    return null;
}

function currentCodeBlock() {
    const info = currentSelectionInfo();
    if(!info.inside) return null;
    return closestInsideEditor(info.range.commonAncestorContainer, "PRE");
}

function selectedCodeBlock(range) {
    if(!range || !activeEditor) return null;
    const block = currentCodeBlock();
    if(block) return block;
    return Array.from(activeEditor.querySelectorAll("pre")).find((pre) => range.intersectsNode(pre));
}

function ensureCaretInEditor() {
    const info = currentSelectionInfo();
    if(info.inside) return info;

    focusDoc();
    const range = document.createRange();
    range.selectNodeContents(activeEditor);
    range.collapse(false);
    setSelectionRange(range);
    return currentSelectionInfo();
}

function placeCaretAtStart(node) {
    const range = document.createRange();
    range.setStart(node, 0);
    range.collapse(true);
    setSelectionRange(range);
}

function placeCaretAtEnd(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    setSelectionRange(range);
}

function selectNodeContents(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    setSelectionRange(range);
}

function selectTextNode(node) {
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, node.textContent.length);
    setSelectionRange(range);
}

function groupId() {
    return "code-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fragmentHasContent(fragment) {
    return fragment.textContent.length > 0 || Array.from(fragment.childNodes).some((node) => node.nodeType === Node.ELEMENT_NODE);
}

function makeParagraphFromFragment(fragment, group, side) {
    if(!fragmentHasContent(fragment)) return null;
    const p = document.createElement("p");
    p.dataset.codeGroup = group;
    p.dataset.codeSide = side;
    p.appendChild(fragment);
    return p;
}

function moveChildren(from, to) {
    while(from.firstChild) to.appendChild(from.firstChild);
}

function makeParagraphFromText(text) {
    const p = document.createElement("p");
    const lines = String(text || "").split("\n");
    if(lines.length === 1 && lines[0] === "") {
        p.innerHTML = "<br>";
        return p;
    }
    lines.forEach((line, index) => {
        if(index) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(line));
    });
    return p;
}

function unwrapCodeBlock(block, keepSelected) {
    if(block.dataset.codeGroup) {
        const group = block.dataset.codeGroup;
        const prev = block.previousElementSibling;
        const next = block.nextElementSibling;
        const before = prev && prev.dataset.codeGroup === group && prev.dataset.codeSide === "before" ? prev : null;
        const after = next && next.dataset.codeGroup === group && next.dataset.codeSide === "after" ? next : null;
        const p = document.createElement("p");

        if(before) {
            moveChildren(before, p);
            before.remove();
        }

        const textNode = document.createTextNode(block.textContent);
        p.appendChild(textNode);

        if(after) {
            moveChildren(after, p);
            after.remove();
        }

        block.replaceWith(p);
        if(keepSelected) selectTextNode(textNode);
        else placeCaretAtEnd(p);
        return;
    }

    const p = makeParagraphFromText(block.textContent);
    block.replaceWith(p);
    if(keepSelected) selectNodeContents(p);
    else placeCaretAtEnd(p);
}

function updateToolbarState() {
    const info = currentSelectionInfo();
    const boldButton = $("[data-cmd='bold']");
    const codeButton = $("#insertCodeBlock");
    boldButton?.classList.toggle("active", activeBold);
    $all("[data-size]").forEach((button) => {
        button.classList.toggle("active", button.dataset.size === activeSize);
    });
    $all("[data-color]").forEach((button) => {
        button.classList.toggle("active", button.dataset.color === activeColor);
    });
    codeButton?.classList.toggle("active", info.inside && !!selectedCodeBlock(info.range));
}

function setTextSize(size) {
    restoreSelection();
    const hasSelectedText = currentSelectionInfo().selected;
    document.execCommand("fontSize", false, sizeConfig[size].command);
    if(hasSelectedText) {
        saveSelection();
    }
    else {
        activeSize = activeSize === size ? null : size;
        if(activeSize === null) document.execCommand("fontSize", false, sizeConfig.normal.command);
        saveSelection();
    }
    updateToolbarState();
    updatePreview();
}

function setTextColor(color) {
    restoreSelection();
    document.execCommand("foreColor", false, color);
    activeColor = color;
    saveSelection();
    updateToolbarState();
    updatePreview();
}

function makeCodeBlock(text, group = "") {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    const textNode = document.createTextNode(text);
    code.appendChild(textNode);
    pre.appendChild(code);
    if(group) pre.dataset.codeGroup = group;
    return { pre, code, textNode };
}

function turnSelectedTextIntoCode(range) {
    const startBlock = closestBlock(range.startContainer);
    const endBlock = closestBlock(range.endContainer);
    const selectedText = range.toString();

    if(startBlock && startBlock === endBlock && startBlock.tagName !== "PRE") {
        const group = groupId();
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(startBlock);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(startBlock);
        afterRange.setStart(range.endContainer, range.endOffset);

        const before = makeParagraphFromFragment(beforeRange.cloneContents(), group, "before");
        const after = makeParagraphFromFragment(afterRange.cloneContents(), group, "after");
        const { pre, textNode } = makeCodeBlock(selectedText, group);

        if(before) startBlock.before(before);
        startBlock.before(pre);
        if(after) startBlock.before(after);
        startBlock.remove();
        selectTextNode(textNode);
        return;
    }

    const { pre, textNode } = makeCodeBlock(selectedText);
    range.deleteContents();
    range.insertNode(pre);
    selectTextNode(textNode);
}

function insertCodeBlock() {
    restoreSelection();
    const info = ensureCaretInEditor();
    const existingBlock = selectedCodeBlock(info.range);

    if(existingBlock) {
        unwrapCodeBlock(existingBlock, info.selected);
        updateToolbarState();
        updatePreview();
        return;
    }

    if(info.selected) {
        turnSelectedTextIntoCode(info.range);
        updateToolbarState();
        updatePreview();
        return;
    }

    const { pre, code } = makeCodeBlock("");
    info.range.insertNode(pre);
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    pre.after(p);
    placeCaretAtStart(code);
    updateToolbarState();
    updatePreview();
}

function currentDraft() {
    const problemDescription = $("#problemDescription");
    const solutionDescription = $("#solutionDescription");
    if(problemDescription) {
        stripPastedPaint(problemDescription);
        stripPastedLayout(problemDescription);
        normalizeFontTags(problemDescription);
    }
    if(solutionDescription) {
        stripPastedLayout(solutionDescription);
        normalizeFontTags(solutionDescription);
    }
    return {
        title: $("#title")?.value || "",
        url: $("#url")?.value || "",
        problemDescription: editorIsEmpty(problemDescription) ? "" : problemDescription.innerHTML,
        solutionDescription: editorIsEmpty(solutionDescription) ? "" : solutionDescription.innerHTML,
        code: $("#code")?.value || ""
    };
}

function applyDraft(solution) {
    const draft = normalizeSolution(solution || blankSolution(""));
    $("#title").value = draft.title || "";
    $("#url").value = draft.url || "";
    $("#problemDescription").innerHTML = draft.problemDescription || "";
    $("#solutionDescription").innerHTML = draft.solutionDescription || "";
    $("#code").value = draft.code || "";
    stripPastedPaint($("#problemDescription"));
    stripPastedLayout($("#problemDescription"));
    stripPastedLayout($("#solutionDescription"));
    normalizeFontTags($("#problemDescription"));
    normalizeFontTags($("#solutionDescription"));
    activeEditor = $("#solutionDescription");
    updatePreview();
}

function updatePreview() {
    if(page !== "solution") return;

    const title = $("#title").value.trim() || "Untitled Problem";
    const url = $("#url").value.trim();
    const code = $("#code").value;
    const problemHtml = renderRichEditor($("#problemDescription"));
    const solutionHtml = renderRichEditor($("#solutionDescription"));
    $("#previewTitle").textContent = title;
    $("#previewProblemDescription").innerHTML = problemHtml;
    $("#previewSolutionDescription").innerHTML = solutionHtml;
    forceSolutionWidth($("#previewSolutionDescription"));
    $("#previewProblemDescription").closest(".preview-section").hidden = !problemHtml;
    $("#previewSolutionDescription").closest(".preview-section").hidden = !solutionHtml;
    $("#previewCode").innerHTML = highlightCpp(code);
    $("#previewCodeSection").hidden = !code.trim();

    const previewUrl = $("#previewUrl");
    if(url) {
        previewUrl.textContent = url;
        previewUrl.href = url;
        previewUrl.style.display = "inline-block";
    }
    else {
        previewUrl.textContent = "Problem link";
        previewUrl.href = "#";
        previewUrl.style.display = "none";
    }
}

function saveCurrentSolution() {
    const contest = activeContest();
    let solution = activeSolution();
    if(!contest || !solution) {
        alert("This solution no longer exists.");
        return;
    }

    const draft = currentDraft();
    solution.title = draft.title.trim() || solution.title || "Untitled Solution";
    solution.url = draft.url;
    solution.problemDescription = draft.problemDescription;
    solution.solutionDescription = draft.solutionDescription;
    solution.code = draft.code;
    solution.updatedAt = new Date().toISOString();
    contest.updatedAt = solution.updatedAt;
    saveLibrary();
    updatePreview();
    window.location.href = solutionUrl(contest.platformId, contest.id, solution.id);
}

function deleteCurrentSolution() {
    const contest = activeContest();
    const solution = activeSolution();
    if(!contest || !solution) return;
    if(!confirm(`Delete "${solution.title || "Untitled Solution"}"?`)) return;
    contest.solutions = contest.solutions.filter((item) => item.id !== solution.id);
    library.activeSolutionId = contest.solutions[0]?.id || null;
    saveLibrary();
    window.location.href = contestUrl(contest.platformId, contest.id);
}

function deleteCurrentContest() {
    const contest = activeContest();
    if(!contest) return;
    if(!confirm(`Delete contest "${contest.name}" and all its saved solutions?`)) return;
    const platformId = contest.platformId;
    library.contests = library.contests.filter((item) => item.id !== contest.id);
    saveLibrary();
    window.location.href = platformUrl(platformId);
}

function deleteCurrentPlatform() {
    const platform = activePlatform();
    if(!platform) return;
    if(!confirm(`Delete platform "${platform.name}" and all contests inside it?`)) return;
    library.platforms = library.platforms.filter((item) => item.id !== platform.id);
    library.contests = library.contests.filter((contest) => contest.platformId !== platform.id);
    library.activePlatformId = library.platforms[0]?.id || null;
    library.activeContestId = null;
    library.activeSolutionId = null;
    saveLibrary();
    window.location.href = "./";
}

function exportHtml() {
    updatePreview();
    const draft = currentDraft();
    const problem = renderRichEditor($("#problemDescription"));
    const solution = renderRichEditor($("#solutionDescription"));
    const highlightedCode = highlightCpp(draft.code || "");
    const safeTitle = escapeHtml(draft.title || "Untitled Problem");
    const safeUrl = escapeHtml(draft.url || "");

    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
        body{font-family:system-ui,sans-serif;line-height:1.6;max-width:80rem;margin:2.5rem auto;padding:0 1.125rem;background:#090909;color:#f4f1ea}
        a{color:#39d0b0}h2{margin-top:2.125rem}
        .problem-title{color:rgb(0,229,255)}.solution-title{color:rgb(57,208,176)}
        pre{overflow-x:hidden;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;border-radius:0.5rem;background:#020403;padding:1rem;color:#f8fafc}
        code{white-space:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
        .tok-keyword{color:#00e5ff;font-weight:850}.tok-type{color:#ff4fd8;font-weight:800}.tok-string{color:#ffe66d}.tok-number{color:#ff9f1c;font-weight:750}.tok-comment{color:#00ff85;font-style:italic}.tok-pre{color:#b6ff00;font-weight:850}
    </style>
</head>
<body>
    <article>
        <h1>${safeTitle}</h1>
        ${safeUrl ? `<p><a href="${safeUrl}">${safeUrl}</a></p>` : ""}
        ${problem ? `<h2 class="problem-title">Problem Description</h2><section>${problem}</section>` : ""}
        ${solution ? `<h2 class="solution-title">Solution Writeup</h2><section>${solution}</section>` : ""}
        ${draft.code.trim() ? `<h2>C++ Code</h2><pre><code class="language-cpp">${highlightedCode}</code></pre>` : ""}
    </article>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = slug(draft.title || "solution") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

function exportDataJson() {
    repairActivePointers();
    const data = JSON.stringify(library, null, 2) + "\n";
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

function renderPlatformsPage() {
    const platformList = $("#platformList");
    const storageHint = $("#storageHint");
    const platformCount = library.platforms.length;
    const contestCount = library.contests.length;
    const solutionCount = library.contests.reduce((sum, contest) => sum + contest.solutions.length, 0);
    const sourceText = librarySource === "data.json"
        ? "Loaded from writeup-studio/data.json."
        : librarySource === "localStorage"
            ? "Using browser-local edits."
            : "No saved data loaded yet.";
    storageHint.textContent = `${sourceText} ${platformCount} platform${platformCount === 1 ? "" : "s"}, ${contestCount} contest${contestCount === 1 ? "" : "s"}, ${solutionCount} solution${solutionCount === 1 ? "" : "s"}. Export data.json when you want to publish these notes.`;

    if(platformCount === 0) {
        platformList.innerHTML = `<section class="panel empty-state"><h2>No platforms yet</h2><p>Create Codeforces, LeetCode, CodeChef, or any other platform above.</p></section>`;
        return;
    }

    platformList.innerHTML = "";
    library.platforms.forEach((platform) => {
        const contests = contestsForPlatform(platform.id);
        const solutions = contests.reduce((sum, contest) => sum + contest.solutions.length, 0);
        const card = document.createElement("article");
        card.className = "panel contest-card";
        card.innerHTML = `
            <div>
                <span class="tag">Platform</span>
                <h2>${escapeHtml(platform.name)}</h2>
                <p>${contests.length} contest${contests.length === 1 ? "" : "s"} · ${solutions} solution${solutions === 1 ? "" : "s"}</p>
                ${platform.url ? `<p><a href="${escapeHtml(platform.url)}" target="_blank" rel="noreferrer">${escapeHtml(platform.url)}</a></p>` : ""}
            </div>
            <div class="actions">
                <a class="button-link" href="${platformUrl(platform.id)}">Open</a>
                <button type="button" data-delete-platform="${platform.id}">Delete</button>
            </div>`;
        platformList.appendChild(card);
    });

    $all("[data-delete-platform]").forEach((button) => {
        button.addEventListener("click", () => {
            library.activePlatformId = button.dataset.deletePlatform;
            deleteCurrentPlatform();
        });
    });
}

function createPlatform() {
    const name = $("#platformName").value.trim();
    if(!name) {
        alert("Give the platform a name first.");
        return;
    }

    const platform = blankPlatform(name, $("#platformUrl").value.trim());
    library.platforms.push(platform);
    library.activePlatformId = platform.id;
    library.activeContestId = null;
    library.activeSolutionId = null;
    saveLibrary();
    window.location.href = platformUrl(platform.id);
}

function renderPlatformPage() {
    const platform = activePlatform();
    if(!platform) {
        $("#platformTitle").textContent = "Platform Not Found";
        $("#platformMeta").textContent = "Go back and create or open a platform.";
        $("#contestList").innerHTML = `<section class="panel empty-state"><h2>No platform selected</h2><p><a href="./">Back to platforms</a></p></section>`;
        $("#createContestBtn").disabled = true;
        $("#deletePlatformBtn").disabled = true;
        return;
    }

    $("#platformTitle").textContent = platform.name;
    const contests = contestsForPlatform(platform.id);
    $("#platformMeta").innerHTML = platform.url
        ? `<a href="${escapeHtml(platform.url)}" target="_blank" rel="noreferrer">${escapeHtml(platform.url)}</a>`
        : `${contests.length} saved contest${contests.length === 1 ? "" : "s"}`;

    renderPlatformContests();
}

function renderPlatformContests() {
    const platform = activePlatform();
    const contestList = $("#contestList");
    if(!platform) return;

    const q = ($("#contestSearch")?.value || "").trim().toLowerCase();
    const contests = contestsForPlatform(platform.id).filter((contest) => {
        if(!q) return true;
        return contest.name.toLowerCase().includes(q) || (contest.url || "").toLowerCase().includes(q);
    });

    if(contests.length === 0) {
        contestList.innerHTML = `<section class="panel empty-state"><h2>No contests found</h2><p>${q ? "Try a different search." : "Create your first contest above."}</p></section>`;
        return;
    }

    contestList.innerHTML = "";
    contests.forEach((contest) => {
        const card = document.createElement("article");
        card.className = "panel contest-card";
        card.innerHTML = `
            <div>
                <span class="tag">Contest</span>
                <h2>${escapeHtml(contest.name)}</h2>
                <p>${contest.solutions.length} saved solution${contest.solutions.length === 1 ? "" : "s"}</p>
                ${contest.url ? `<p><a href="${escapeHtml(contest.url)}" target="_blank" rel="noreferrer">${escapeHtml(contest.url)}</a></p>` : ""}
            </div>
            <div class="actions">
                <a class="button-link" href="${contestUrl(platform.id, contest.id)}">Open</a>
                <button type="button" data-delete-contest="${contest.id}">Delete</button>
            </div>`;
        contestList.appendChild(card);
    });

    $all("[data-delete-contest]").forEach((button) => {
        button.addEventListener("click", () => {
            library.activeContestId = button.dataset.deleteContest;
            deleteCurrentContest();
        });
    });
}

function createContest() {
    const platform = activePlatform();
    if(!platform) return;
    const name = $("#contestName").value.trim();
    if(!name) {
        alert("Give the contest a name first.");
        return;
    }

    const contest = {
        id: makeId("contest"),
        platformId: platform.id,
        name,
        url: $("#contestUrl").value.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        solutions: []
    };
    library.contests.push(contest);
    library.activeContestId = contest.id;
    library.activeSolutionId = null;
    saveLibrary();
    window.location.href = contestUrl(platform.id, contest.id);
}

function renderContestPage() {
    const platform = activePlatform();
    const contest = activeContest();
    if(!platform || !contest) {
        $("#contestTitle").textContent = "Contest Not Found";
        $("#contestMeta").textContent = "Go back and create or open a contest.";
        $("#solutionList").innerHTML = `<section class="panel empty-state"><h2>No contest selected</h2><p><a href="./">Back to contests</a></p></section>`;
        $("#newSolutionBtn").disabled = true;
        $("#deleteContestBtn").disabled = true;
        return;
    }

    $("#backToPlatform").href = platformUrl(platform.id);
    $("#contestTitle").textContent = contest.name;
    $("#contestMeta").innerHTML = contest.url
        ? `<a href="${escapeHtml(contest.url)}" target="_blank" rel="noreferrer">${escapeHtml(contest.url)}</a>`
        : `${contest.solutions.length} saved solution${contest.solutions.length === 1 ? "" : "s"}`;

    const solutionList = $("#solutionList");
    if(contest.solutions.length === 0) {
        solutionList.innerHTML = `<section class="panel empty-state"><h2>No solutions yet</h2><p>Create one above.</p></section>`;
        return;
    }

    solutionList.innerHTML = "";
    contest.solutions.forEach((solution) => {
        const card = document.createElement("article");
        card.className = "panel contest-card";
        card.innerHTML = `
            <div>
                <span class="tag">Solution</span>
                <h2>${escapeHtml(solution.title)}</h2>
                ${solution.url ? `<p><a href="${escapeHtml(solution.url)}" target="_blank" rel="noreferrer">${escapeHtml(solution.url)}</a></p>` : "<p>No problem URL saved yet.</p>"}
            </div>
            <div class="actions">
                <a class="button-link" href="${solutionUrl(platform.id, contest.id, solution.id)}">Preview</a>
            </div>`;
        solutionList.appendChild(card);
    });
}

function createSolution() {
    const platform = activePlatform();
    const contest = activeContest();
    if(!platform || !contest) return;
    const title = $("#newSolutionTitle").value.trim() || `Solution ${contest.solutions.length + 1}`;
    const url = $("#newSolutionUrl").value.trim();
    const solution = blankSolution(title, url);
    contest.solutions.push(solution);
    contest.updatedAt = new Date().toISOString();
    library.activeSolutionId = solution.id;
    saveLibrary();
    window.location.href = editSolutionUrl(platform.id, contest.id, solution.id);
}

function renderSolutionPage() {
    const platform = activePlatform();
    const contest = activeContest();
    const solution = activeSolution();
    if(!platform || !contest || !solution) {
        $(".shell").innerHTML = `<section class="panel empty-state"><h2>Solution not found</h2><p><a href="./">Back to contests</a></p></section>`;
        return;
    }

    const editing = isEditMode();
    document.body.classList.toggle("preview-only", !editing);
    document.body.classList.toggle("edit-mode", editing);
    document.title = `${solution.title || "Solution"} - Solution Blog`;
    $("#contestCrumb").textContent = `${platform.name} / ${contest.name}`;
    $("#backToContest").href = contestUrl(platform.id, contest.id);
    $("#backToPlatform").href = platformUrl(platform.id);
    $("#solutionPageTitle").textContent = editing ? "Solution Editor" : (solution.title || "Untitled Solution");
    $("#solutionPageLead").textContent = editing
        ? "Write the problem statement notes, your solution explanation, and the final C++ code."
        : "Saved preview for this solution.";
    $("#editSolutionLink").href = editing ? solutionUrl(platform.id, contest.id, solution.id) : editSolutionUrl(platform.id, contest.id, solution.id);
    $("#editSolutionLink").textContent = editing ? "Preview" : "Edit";
    applyDraft(solution);
}

function bindRichToolbar() {
    $all("[data-rich-editor]").forEach((editor) => {
        editor.addEventListener("focus", () => {
            activeEditor = editor;
            saveSelection();
            updateToolbarState();
        });
        editor.addEventListener("input", () => {
            if(editor.id === "problemDescription") stripPastedPaint(editor);
            stripPastedLayout(editor);
            updatePreview();
        });
        editor.addEventListener("keyup", saveSelection);
        editor.addEventListener("mouseup", saveSelection);
    });

    $("#problemDescription")?.addEventListener("paste", sanitizeProblemPaste);
    $("#solutionDescription")?.addEventListener("paste", sanitizeSolutionPaste);

    $all("[data-cmd]").forEach((button) => {
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => {
            restoreSelection();
            const hasSelectedText = currentSelectionInfo().selected;
            if(button.dataset.cmd === "bold") {
                if(hasSelectedText) {
                    document.execCommand("bold", false, null);
                }
                else {
                    activeBold = !activeBold;
                    document.execCommand("bold", false, null);
                }
            }
            else {
                document.execCommand(button.dataset.cmd, false, null);
            }
            saveSelection();
            updateToolbarState();
            updatePreview();
        });
    });

    $all("[data-size]").forEach((button) => {
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => setTextSize(button.dataset.size));
    });

    $all("[data-color]").forEach((button) => {
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => setTextColor(button.dataset.color));
    });

    $all(".toolbar button").forEach((button) => {
        button.addEventListener("mousedown", (event) => event.preventDefault());
    });

    $("#insertCodeBlock")?.addEventListener("click", insertCodeBlock);
    $("#clearFormat")?.addEventListener("click", () => {
        restoreSelection();
        document.execCommand("removeFormat", false, null);
        activeBold = false;
        activeSize = null;
        activeColor = null;
        saveSelection();
        updateToolbarState();
        updatePreview();
    });

    document.addEventListener("selectionchange", () => {
        saveSelection();
        updateToolbarState();
    });
}

function initPlatformsPage() {
    renderPlatformsPage();
    $("#createPlatformBtn").addEventListener("click", createPlatform);
    $("#exportDataBtn").addEventListener("click", exportDataJson);
}

function initPlatformPage() {
    renderPlatformPage();
    $("#createContestBtn").addEventListener("click", createContest);
    $("#contestSearch").addEventListener("input", renderPlatformContests);
    $("#deletePlatformBtn").addEventListener("click", deleteCurrentPlatform);
}

function initContestPage() {
    renderContestPage();
    $("#newSolutionBtn").addEventListener("click", createSolution);
    $("#deleteContestBtn").addEventListener("click", deleteCurrentContest);
}

function initSolutionPage() {
    bindRichToolbar();
    renderSolutionPage();
    $("#previewBtn").addEventListener("click", updatePreview);
    $("#saveBtn").addEventListener("click", saveCurrentSolution);
    $("#loadBtn").addEventListener("click", () => applyDraft(activeSolution()));
    $("#deleteSolutionBtn").addEventListener("click", deleteCurrentSolution);
    $("#exportBtn").addEventListener("click", exportHtml);
    ["#title", "#url", "#code"].forEach((selector) => {
        $(selector).addEventListener("input", updatePreview);
    });
}

async function initApp() {
    await loadLibrary();
    setActiveFromQuery();

    if(page === "platforms") initPlatformsPage();
    if(page === "platform") initPlatformPage();
    if(page === "contest") initContestPage();
    if(page === "solution") initSolutionPage();
}

initApp();
