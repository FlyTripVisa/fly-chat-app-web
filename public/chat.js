/**
 * LLM Chat App Frontend - Optimized for Mobile
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
    {
        role: "assistant",
        content: "Hello! How can I help you today?",
    },
];
let isProcessing = false;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 150) + "px"; // Limit max height
});

// Send message on Enter
userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API
 */
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === "" || isProcessing) return;

    isProcessing = true;
    userInput.disabled = true;
    sendButton.disabled = true;

    addMessageToChat("user", message);
    userInput.value = "";
    userInput.style.height = "auto";
    typingIndicator.classList.add("visible");

    chatHistory.push({ role: "user", content: message });

    try {
        const assistantMessageEl = document.createElement("div");
        assistantMessageEl.className = "message assistant-message";
        assistantMessageEl.innerHTML = "<p></p>";
        chatMessages.appendChild(assistantMessageEl);
        const assistantTextEl = assistantMessageEl.querySelector("p");

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory }),
        });

        if (!response.ok) throw new Error("Failed to connect");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parsed = consumeSseEvents(buffer);
            buffer = parsed.buffer;

            for (const data of parsed.events) {
                if (data === "[DONE]") break;
                try {
                    const jsonData = JSON.parse(data);
                    const content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
                    if (content) {
                        responseText += content;
                        assistantTextEl.textContent = responseText;
                        // মোবাইল স্ক্রলিং অপ্টিমাইজেশন
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } catch (e) { console.error(e); }
            }
        }
        chatHistory.push({ role: "assistant", content: responseText });
    } catch (error) {
        addMessageToChat("assistant", "Sorry, an error occurred.");
    } finally {
        typingIndicator.classList.remove("visible");
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus(); // মোবাইল কিবোর্ড ওপেন রাখার জন্য
    }
}

function addMessageToChat(role, content) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}-message`;
    messageEl.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
    let normalized = buffer.replace(/\r/g, "");
    const events = [];
    let eventEndIndex;
    while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
        const rawEvent = normalized.slice(0, eventEndIndex);
        normalized = normalized.slice(eventEndIndex + 2);
        const lines = rawEvent.split("\n");
        for (const line of lines) {
            if (line.startsWith("data:")) events.push(line.slice(5).trimStart());
        }
    }
    return { events, buffer: normalized };
}