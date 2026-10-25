/**
 * NexusTrip - Multi-Agent AI Travel Planner
 * Client-side integration for FastAPI & LangGraph multi-agent backend
 */

(function () {
    "use strict";

    // =========================================================================
    // Application State
    // =========================================================================
    const state = {
        threadId: localStorage.getItem("nexustrip_thread_id") || null,
        totalLlmCalls: 0,
        activeTab: "tab-overview",
        currentView: "chat", // for mobile view switching: 'chat' | 'results'
        isProcessing: false,
        lastResults: null,
        progressInterval: null,
    };

    // =========================================================================
    // DOM Element References
    // =========================================================================
    const dom = {
        // Header
        systemStatusPill: document.getElementById("systemStatusPill"),
        statusLabel: document.getElementById("statusLabel"),
        threadDisplay: document.getElementById("threadDisplay"),
        btnCopyThread: document.getElementById("btnCopyThread"),
        llmCallsCount: document.getElementById("llmCallsCount"),
        btnNewTrip: document.getElementById("btnNewTrip"),
        themeToggleBtn: document.getElementById("themeToggleBtn"),

        // Mobile Switcher
        viewSwitch: document.getElementById("viewSwitch"),
        btnViewChat: document.getElementById("btnViewChat"),
        btnViewResults: document.getElementById("btnViewResults"),
        resultsBadge: document.getElementById("resultsAvailableBadge"),

        // Panels
        panelChat: document.getElementById("panelChat"),
        panelResults: document.getElementById("panelResults"),

        // Pipeline Steps
        stepGuardrail: document.getElementById("stepGuardrail"),
        stepSupervisor: document.getElementById("stepSupervisor"),
        stepSpecialists: document.getElementById("stepSpecialists"),
        stepItinerary: document.getElementById("stepItinerary"),

        // Chat UI
        chatMessages: document.getElementById("chatMessages"),
        welcomeCard: document.getElementById("welcomeCard"),
        agentActivityBanner: document.getElementById("agentActivityBanner"),
        activityTitle: document.getElementById("activityTitle"),
        activitySubtitle: document.getElementById("activitySubtitle"),
        chatForm: document.getElementById("chatForm"),
        messageInput: document.getElementById("messageInput"),
        btnClearInput: document.getElementById("btnClearInput"),
        btnSubmit: document.getElementById("btnSubmit"),

        // Quick Builder
        btnToggleBuilder: document.getElementById("btnToggleBuilder"),
        builderChevron: document.getElementById("builderChevron"),
        builderFormBody: document.getElementById("builderFormBody"),
        builderDest: document.getElementById("builderDest"),
        builderOrigin: document.getElementById("builderOrigin"),
        builderDuration: document.getElementById("builderDuration"),
        builderBudget: document.getElementById("builderBudget"),
        builderStyle: document.getElementById("builderStyle"),
        btnBuilderGenerate: document.getElementById("btnBuilderGenerate"),

        // Dossier & Tabs
        tabButtons: document.querySelectorAll(".dossier-tabs .tab-btn"),
        tabPanels: document.querySelectorAll(".tab-panel"),
        btnCopyPlan: document.getElementById("btnCopyPlan"),
        btnPrintPlan: document.getElementById("btnPrintPlan"),
        dossierCaption: document.getElementById("dossierCaption"),

        // Dossier Content
        emptyOverview: document.getElementById("emptyOverview"),
        contentOverview: document.getElementById("contentOverview"),
        emptyFlights: document.getElementById("emptyFlights"),
        contentFlights: document.getElementById("contentFlights"),
        textFlights: document.getElementById("textFlights"),
        emptyHotels: document.getElementById("emptyHotels"),
        contentHotels: document.getElementById("contentHotels"),
        textHotels: document.getElementById("textHotels"),
        emptyItinerary: document.getElementById("emptyItinerary"),
        contentItinerary: document.getElementById("contentItinerary"),
        textItinerary: document.getElementById("textItinerary"),

        // Status Dots
        dotFlights: document.getElementById("dotFlights"),
        dotHotels: document.getElementById("dotHotels"),
        dotItinerary: document.getElementById("dotItinerary"),

        // Telemetry
        telemThreadId: document.getElementById("telemThreadId"),
        telemCalls: document.getElementById("telemCalls"),

        // Toast Container
        toastContainer: document.getElementById("toastContainer"),
    };

    // =========================================================================
    // Initialization
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        initTheme();
        initSession();
        checkBackendHealth();
        bindEvents();
        setupAutoResizeTextarea();
        setInterval(checkBackendHealth, 30000); // Check API health periodically
    });

    // =========================================================================
    // Theme Management
    // =========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem("nexustrip_theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("nexustrip_theme", newTheme);
        showToast(`Switched to ${newTheme} mode`, "info");
    }

    // =========================================================================
    // Session & Thread Management
    // =========================================================================
    function initSession() {
        updateThreadDisplay(state.threadId);
    }

    function setThreadId(newId) {
        state.threadId = newId;
        if (newId) {
            localStorage.setItem("nexustrip_thread_id", newId);
        } else {
            localStorage.removeItem("nexustrip_thread_id");
        }
        updateThreadDisplay(newId);
    }

    function updateThreadDisplay(threadId) {
        if (!threadId) {
            dom.threadDisplay.textContent = "New Session";
            dom.btnCopyThread.classList.add("hidden");
            dom.telemThreadId.textContent = "None";
            return;
        }

        const shortId = threadId.length > 16
            ? threadId.substring(0, 10) + "..." + threadId.slice(-4)
            : threadId;

        dom.threadDisplay.textContent = shortId;
        dom.threadDisplay.title = threadId;
        dom.btnCopyThread.classList.remove("hidden");
        dom.telemThreadId.textContent = threadId;
    }

    function resetSession() {
        if (state.isProcessing) return;

        if (confirm("Start a new trip session? This clears the current conversation and thread.")) {
            setThreadId(null);
            state.totalLlmCalls = 0;
            state.lastResults = null;
            dom.llmCallsCount.textContent = "0";
            dom.telemCalls.textContent = "0";

            // Clear chat stream except welcome card
            const messages = dom.chatMessages.querySelectorAll(".chat-msg");
            messages.forEach((msg) => msg.remove());
            dom.welcomeCard.classList.remove("hidden");

            // Reset Dossier
            resetDossierTabs();

            // Reset Pipeline steps
            resetPipelineSteps();

            showToast("New trip session initialized", "info");
        }
    }

    function resetDossierTabs() {
        dom.contentOverview.innerHTML = "";
        dom.contentOverview.classList.add("hidden");
        dom.emptyOverview.classList.remove("hidden");

        dom.textFlights.innerHTML = "";
        dom.contentFlights.classList.add("hidden");
        dom.emptyFlights.classList.remove("hidden");
        dom.dotFlights.classList.remove("active");

        dom.textHotels.innerHTML = "";
        dom.contentHotels.classList.add("hidden");
        dom.emptyHotels.classList.remove("hidden");
        dom.dotHotels.classList.remove("active");

        dom.textItinerary.innerHTML = "";
        dom.contentItinerary.classList.add("hidden");
        dom.emptyItinerary.classList.remove("hidden");
        dom.dotItinerary.classList.remove("active");

        dom.resultsBadge.classList.add("hidden");
        dom.dossierCaption.textContent = "Deep dive into specialized agent reports";
    }

    // =========================================================================
    // Health Check
    // =========================================================================
    async function checkBackendHealth() {
        try {
            const response = await fetch("/health", { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                dom.systemStatusPill.className = "system-status-pill online";
                dom.statusLabel.textContent = "Backend: Online";
            } else {
                throw new Error("Health check non-200");
            }
        } catch (err) {
            dom.systemStatusPill.className = "system-status-pill offline";
            dom.statusLabel.textContent = "Backend: Offline";
        }
    }

    // =========================================================================
    // Event Listeners
    // =========================================================================
    function bindEvents() {
        // Theme Toggle
        dom.themeToggleBtn.addEventListener("click", toggleTheme);

        // New Trip Button
        dom.btnNewTrip.addEventListener("click", resetSession);

        // Copy Thread ID
        dom.btnCopyThread.addEventListener("click", () => {
            if (state.threadId) {
                navigator.clipboard.writeText(state.threadId);
                showToast("Thread ID copied to clipboard", "success");
            }
        });

        // Chat Form Submission
        dom.chatForm.addEventListener("submit", handleChatSubmit);

        // Clear input button
        dom.btnClearInput.addEventListener("click", () => {
            dom.messageInput.value = "";
            dom.messageInput.style.height = "auto";
            dom.messageInput.focus();
        });

        // Textarea keyboard shortcuts: Enter to send, Shift+Enter for newline
        dom.messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                dom.chatForm.requestSubmit();
            }
        });

        // Quick Suggestion Chips
        document.querySelectorAll(".chip-btn").forEach((chip) => {
            chip.addEventListener("click", () => {
                const prompt = chip.getAttribute("data-prompt");
                if (prompt) {
                    dom.messageInput.value = prompt;
                    dom.messageInput.style.height = "auto";
                    dom.messageInput.focus();
                    // Scroll to bottom
                    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
                }
            });
        });

        // Quick Builder Accordion
        dom.btnToggleBuilder.addEventListener("click", () => {
            const isOpen = dom.btnToggleBuilder.classList.toggle("open");
            dom.builderFormBody.classList.toggle("hidden", !isOpen);
        });

        // Builder Generate Prompt Button
        dom.btnBuilderGenerate.addEventListener("click", handleBuilderGenerate);

        // Dossier Tabs
        dom.tabButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                switchDossierTab(targetTab);
            });
        });

        // Copy Plan Button
        dom.btnCopyPlan.addEventListener("click", handleCopyActivePlan);

        // Print Plan Button
        dom.btnPrintPlan.addEventListener("click", () => {
            window.print();
        });

        // Mobile View Switcher
        dom.btnViewChat.addEventListener("click", () => switchMobileView("chat"));
        dom.btnViewResults.addEventListener("click", () => switchMobileView("results"));
    }

    // =========================================================================
    // Auto-resizing Textarea
    // =========================================================================
    function setupAutoResizeTextarea() {
        const tx = dom.messageInput;
        tx.addEventListener("input", () => {
            tx.style.height = "auto";
            tx.style.height = Math.min(tx.scrollHeight, 140) + "px";
        });
    }

    // =========================================================================
    // Quick Trip Builder
    // =========================================================================
    function handleBuilderGenerate() {
        const dest = dom.builderDest.value.trim();
        const origin = dom.builderOrigin.value.trim();
        const duration = dom.builderDuration.value.trim() || "5";
        const budget = dom.builderBudget.value;
        const style = dom.builderStyle.value.trim();

        if (!dest) {
            showToast("Please enter a destination in the builder", "error");
            dom.builderDest.focus();
            return;
        }

        let prompt = `Plan a ${duration}-day trip to ${dest}`;
        if (origin) {
            prompt += ` departing from ${origin}`;
        }
        prompt += ` with a ${budget.toLowerCase()} budget.`;

        if (style) {
            prompt += ` Travel preferences: ${style}.`;
        }

        prompt += " Provide flight route suggestions, best hotels, daily itinerary highlights, and budget estimates.";

        dom.messageInput.value = prompt;
        dom.messageInput.style.height = "auto";
        dom.builderFormBody.classList.add("hidden");
        dom.btnToggleBuilder.classList.remove("open");
        dom.messageInput.focus();
        showToast("Travel prompt populated!", "success");
    }

    // =========================================================================
    // Dossier Tabs & View Switching
    // =========================================================================
    function switchDossierTab(tabId) {
        state.activeTab = tabId;

        dom.tabButtons.forEach((btn) => {
            const isTarget = btn.getAttribute("data-tab") === tabId;
            btn.classList.toggle("active", isTarget);
        });

        dom.tabPanels.forEach((panel) => {
            panel.classList.toggle("active", panel.id === tabId);
        });
    }

    function switchMobileView(viewName) {
        state.currentView = viewName;
        if (viewName === "chat") {
            dom.btnViewChat.classList.add("active");
            dom.btnViewResults.classList.remove("active");
            dom.panelChat.classList.remove("view-hidden");
            dom.panelResults.classList.add("view-hidden");
        } else {
            dom.btnViewResults.classList.add("active");
            dom.btnViewChat.classList.remove("active");
            dom.panelResults.classList.remove("view-hidden");
            dom.panelChat.classList.add("view-hidden");
        }
    }

    // =========================================================================
    // Pipeline Animation Helper
    // =========================================================================
    function startPipelineAnimation() {
        resetPipelineSteps();
        dom.agentActivityBanner.classList.remove("hidden");

        const steps = [
            { el: dom.stepGuardrail, title: "Input Guardrail Active", sub: "Validating travel scope and safety checks..." },
            { el: dom.stepSupervisor, title: "Supervisor Routing", sub: "Analyzing user constraints and delegating to specialist agents..." },
            { el: dom.stepSpecialists, title: "MCP Specialist Execution", sub: "Querying Aviation MCP, Tavily Hotel Search & Weather tools..." },
            { el: dom.stepItinerary, title: "Itinerary Synthesis", sub: "Synthesizing master schedule and preparing traveler dossier..." },
        ];

        let index = 0;
        steps[0].el.classList.add("active");
        dom.activityTitle.textContent = steps[0].title;
        dom.activitySubtitle.textContent = steps[0].sub;

        state.progressInterval = setInterval(() => {
            index++;
            if (index < steps.length) {
                steps.forEach((s, idx) => s.el.classList.toggle("active", idx <= index));
                dom.activityTitle.textContent = steps[index].title;
                dom.activitySubtitle.textContent = steps[index].sub;
            }
        }, 3500);
    }

    function stopPipelineAnimation(success = true) {
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }

        dom.agentActivityBanner.classList.add("hidden");

        if (success) {
            [dom.stepGuardrail, dom.stepSupervisor, dom.stepSpecialists, dom.stepItinerary].forEach((el) => {
                el.classList.add("active");
            });
        }
    }

    function resetPipelineSteps() {
        [dom.stepGuardrail, dom.stepSupervisor, dom.stepSpecialists, dom.stepItinerary].forEach((el) => {
            el.classList.remove("active");
        });
    }

    // =========================================================================
    // Chat Message Rendering
    // =========================================================================
    function appendUserMessage(text) {
        const msgEl = document.createElement("div");
        msgEl.className = "chat-msg user";

        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        msgEl.innerHTML = `
            <div class="chat-avatar">👤</div>
            <div class="chat-bubble-content">
                <div class="chat-bubble">${escapeHtml(text)}</div>
                <span class="chat-meta">${now}</span>
            </div>
        `;

        dom.chatMessages.appendChild(msgEl);
        scrollChatToBottom();
    }

    function appendAssistantMessage(htmlContent, isGuardrailAlert = false) {
        const msgEl = document.createElement("div");
        msgEl.className = `chat-msg assistant ${isGuardrailAlert ? "guardrail-alert" : ""}`;

        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        msgEl.innerHTML = `
            <div class="chat-avatar">${isGuardrailAlert ? "🛡️" : "✈️"}</div>
            <div class="chat-bubble-content">
                <div class="chat-bubble markdown-body">${htmlContent}</div>
                <span class="chat-meta">${isGuardrailAlert ? "Guardrail Notice • " : "NexusTrip AI • "}${now}</span>
            </div>
        `;

        dom.chatMessages.appendChild(msgEl);
        scrollChatToBottom();
    }

    function scrollChatToBottom() {
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    // =========================================================================
    // API Call: POST /api/travel
    // =========================================================================
    async function handleChatSubmit(e) {
        e.preventDefault();

        const message = dom.messageInput.value.trim();
        if (!message || state.isProcessing) return;

        // UI Updates for pending request
        state.isProcessing = true;
        setFormSubmitting(true);
        appendUserMessage(message);

        dom.messageInput.value = "";
        dom.messageInput.style.height = "auto";

        // Hide welcome card once chat has begun
        dom.welcomeCard.classList.add("hidden");

        startPipelineAnimation();

        try {
            const payload = {
                message: message,
                thread_id: state.threadId || null,
            };

            const response = await fetch("/api/travel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            stopPipelineAnimation(data.success);

            if (!response.ok || !data.success) {
                const errorMsg = data.error || `Server responded with status ${response.status}`;
                appendAssistantMessage(`<p><strong>Error:</strong> ${escapeHtml(errorMsg)}</p>`);
                showToast(errorMsg, "error");
                return;
            }

            // Successfully received response
            processTravelResponse(data);

        } catch (err) {
            stopPipelineAnimation(false);
            console.error("Travel Planner API Error:", err);
            const errText = `Could not reach the travel agent server. Please ensure the backend is running. (${err.message})`;
            appendAssistantMessage(`<p>⚠️ <strong>Connection Error:</strong> ${escapeHtml(errText)}</p>`);
            showToast("Failed to connect to backend", "error");
        } finally {
            state.isProcessing = false;
            setFormSubmitting(false);
        }
    }

    // =========================================================================
    // Process Response & Update Dossier
    // =========================================================================
    function processTravelResponse(data) {
        state.lastResults = data;

        // Update thread_id
        if (data.thread_id) {
            setThreadId(data.thread_id);
        }

        // Update LLM Calls counter
        if (typeof data.llm_calls === "number") {
            state.totalLlmCalls = data.llm_calls;
            dom.llmCallsCount.textContent = state.totalLlmCalls;
            dom.telemCalls.textContent = state.totalLlmCalls;
        }

        // Check if Guardrail blocked the query
        const isBlocked = isGuardrailBlocked(data.answer);

        // Render main answer in chat
        const renderedAnswer = renderMarkdown(data.answer || "Travel plan created successfully.");
        appendAssistantMessage(renderedAnswer, isBlocked);

        if (isBlocked) {
            showToast("Guardrail: Query outside travel scope", "info");
            return;
        }

        // Update Dossier Panels
        updateDossierData(data);

        // Notify user results are ready
        dom.resultsBadge.classList.remove("hidden");
        showToast("Travel Dossier ready in right panel!", "success");

        // On mobile, offer quick view toggle
        if (window.innerWidth <= 960) {
            showToast("Tap 'Trip Dossier' at the top to explore details", "info");
        }
    }

    function isGuardrailBlocked(answerText) {
        if (!answerText) return false;
        const lower = answerText.toLowerCase();
        return (
            lower.includes("guardrail") ||
            lower.includes("trip mate ai can only help with travel") ||
            lower.includes("blocked") ||
            lower.includes("only help with travel-planning")
        );
    }

    function updateDossierData(data) {
        // Master Plan Overview Tab
        if (data.answer) {
            dom.contentOverview.innerHTML = renderMarkdown(data.answer);
            dom.contentOverview.classList.remove("hidden");
            dom.emptyOverview.classList.add("hidden");
        }

        // Flight Results Tab
        if (data.flight_results && data.flight_results.trim().length > 0) {
            dom.textFlights.innerHTML = renderMarkdown(data.flight_results);
            dom.contentFlights.classList.remove("hidden");
            dom.emptyFlights.classList.add("hidden");
            dom.dotFlights.classList.add("active");
        }

        // Hotel Results Tab
        if (data.hotel_results && data.hotel_results.trim().length > 0) {
            dom.textHotels.innerHTML = renderMarkdown(data.hotel_results);
            dom.contentHotels.classList.remove("hidden");
            dom.emptyHotels.classList.add("hidden");
            dom.dotHotels.classList.add("active");
        }

        // Daily Itinerary Tab
        if (data.itinerary && data.itinerary.trim().length > 0) {
            dom.textItinerary.innerHTML = renderMarkdown(data.itinerary);
            dom.contentItinerary.classList.remove("hidden");
            dom.emptyItinerary.classList.add("hidden");
            dom.dotItinerary.classList.add("active");
        }

        dom.dossierCaption.textContent = `Generated for Session: ${state.threadId || "Current"}`;
    }

    // =========================================================================
    // Clipboard & Copy Utilities
    // =========================================================================
    function handleCopyActivePlan() {
        let contentToCopy = "";

        switch (state.activeTab) {
            case "tab-overview":
                contentToCopy = state.lastResults?.answer || dom.contentOverview.innerText;
                break;
            case "tab-flights":
                contentToCopy = state.lastResults?.flight_results || dom.textFlights.innerText;
                break;
            case "tab-hotels":
                contentToCopy = state.lastResults?.hotel_results || dom.textHotels.innerText;
                break;
            case "tab-itinerary":
                contentToCopy = state.lastResults?.itinerary || dom.textItinerary.innerText;
                break;
            default:
                contentToCopy = state.lastResults?.answer || "";
        }

        if (!contentToCopy || contentToCopy.trim().length === 0) {
            showToast("No content to copy yet", "info");
            return;
        }

        navigator.clipboard.writeText(contentToCopy)
            .then(() => showToast("Copied to clipboard!", "success"))
            .catch(() => showToast("Could not copy to clipboard", "error"));
    }

    function setFormSubmitting(isSubmitting) {
        dom.btnSubmit.disabled = isSubmitting;
        const spinner = dom.btnSubmit.querySelector(".loading-spinner");
        const sendIcon = dom.btnSubmit.querySelector(".send-icon");
        const btnText = dom.btnSubmit.querySelector(".btn-text");

        if (isSubmitting) {
            spinner.classList.remove("hidden");
            sendIcon.classList.add("hidden");
            btnText.textContent = "Agents Thinking...";
        } else {
            spinner.classList.add("hidden");
            sendIcon.classList.remove("hidden");
            btnText.textContent = "Plan Trip";
        }
    }

    // =========================================================================
    // Markdown Parser with Built-in Fallback
    // =========================================================================
    function renderMarkdown(rawText) {
        if (!rawText) return "";

        // If marked.js is available via CDN
        if (typeof window.marked !== "undefined" && typeof window.marked.parse === "function") {
            try {
                return window.marked.parse(rawText);
            } catch (e) {
                console.warn("marked.parse failed, falling back to internal renderer", e);
            }
        }

        // Lightweight internal fallback parser for resilient offline formatting
        return fallbackMarkdownParser(rawText);
    }

    function fallbackMarkdownParser(md) {
        let html = escapeHtml(md);

        // Headings
        html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
        html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
        html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

        // Bold & Italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/gim, "<strong><em>$1</em></strong>");
        html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
        html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, "<pre><code>$1</code></pre>");
        html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");

        // Horizontal Rule
        html = html.replace(/^---$/gim, "<hr>");

        // Unordered Lists
        html = html.replace(/^\s*[-*+]\s+(.*$)/gim, "<li>$1</li>");
        html = html.replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>");

        // Numbered Lists
        html = html.replace(/^\s*\d+\.\s+(.*$)/gim, "<li>$1</li>");

        // Paragraphs & newlines
        const lines = html.split(/\n\n+/);
        html = lines
            .map((block) => {
                const trimmed = block.trim();
                if (!trimmed) return "";
                if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<pre") || trimmed.startsWith("<blockquote") || trimmed.startsWith("<hr")) {
                    return trimmed;
                }
                return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
            })
            .join("\n");

        return html;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // =========================================================================
    // Toast Notification System
    // =========================================================================
    function showToast(message, type = "info") {
        if (!dom.toastContainer) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;

        let icon = "ℹ️";
        if (type === "success") icon = "✅";
        if (type === "error") icon = "❌";

        toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
        dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.25s ease";
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

})();

