'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatBot.module.css';

interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
}

interface ChatBotProps {
    isOpen: boolean;
    onClose: () => void;
    floating?: boolean;
}

const STARTER_PROMPTS = [
    'Who knows Kubernetes or Azure?',
    'Who in Data wants to learn GenAI?',
    'Who is available weekly for coffee?',
];

function renderFormattedText(text: string) {
    // Render **bold** segments safely without dangerouslySetInnerHTML
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={idx}>{part.slice(2, -2)}</strong>;
        }
        return <span key={idx}>{part}</span>;
    });
}

export function ChatBot({ isOpen, onClose, floating = false }: ChatBotProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'bot',
            content: "👋 Hi! I'm FreshBot. Ask me anything about your colleagues' skills, units, or availability!",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const sendMessage = async (textToSend: string) => {
        const trimmed = textToSend.trim();
        if (!trimmed || isTyping) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: trimmed,
            timestamp: Date.now()
        };

        const history = messages
            .filter((m) => m.id !== 'welcome')
            .slice(-10)
            .map((m) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            }));

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history,
                })
            });

            if (!response.ok) {
                const errPayload = await response.json().catch(() => null);
                throw new Error(errPayload?.detail || errPayload?.error || 'Failed to get response');
            }

            const data = await response.json();

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: data.response || "I couldn't generate a response. Please try again.",
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: error instanceof Error && error.message !== 'Failed to get response'
                    ? error.message
                    : "Sorry, I'm having trouble connecting right now. Please try again later.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    };

    const showStarters = messages.length === 1 && !isTyping;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    role="dialog"
                    aria-label="FreshBot colleague assistant"
                    initial={{ opacity: 0, y: floating ? 16 : 0, x: floating ? 0 : -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, y: floating ? 16 : 0, x: floating ? 0 : -20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`${styles.chatWindow} ${floating ? styles.floatingWindow : ''}`}
                >
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            <span className={styles.robotIcon} aria-hidden="true">🤖</span>
                            FreshBot
                        </div>
                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label="Close chat"
                        >
                            ×
                        </button>
                    </div>

                    <div className={styles.messages}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.botMessage}`}
                            >
                                {renderFormattedText(msg.content)}
                            </div>
                        ))}

                        {showStarters && (
                            <div className={styles.starters}>
                                {STARTER_PROMPTS.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        className={styles.starterChip}
                                        onClick={() => sendMessage(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isTyping && (
                            <div className={styles.typingIndicator} aria-label="FreshBot is typing">
                                <div className={styles.dot} />
                                <div className={styles.dot} />
                                <div className={styles.dot} />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Ask about colleagues..."
                            value={input}
                            maxLength={1000}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    sendMessage(input);
                                }
                            }}
                            disabled={isTyping}
                            aria-label="Chat message"
                        />
                        <button
                            type="button"
                            className={styles.sendButton}
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isTyping}
                            aria-label="Send message"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
