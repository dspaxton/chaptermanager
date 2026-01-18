import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { aiApi } from '../lib/api';
import { clsx } from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (message: string) => aiApi.chat(message, conversationId || undefined),
    onSuccess: (response) => {
      const { message, conversationId: newConversationId } = response.data.data;
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
      setConversationId(newConversationId);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    chatMutation.mutate(userMessage);
  };

  const suggestedQuestions = [
    "When's the next chapter ride?",
    "How do I log my mileage?",
    "What are the HOG membership benefits?",
    "Tell me about road captain duties",
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-hog-orange-500 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold">AI Assistant</h1>
          <p className="text-sm text-hog-black-400">Ask me anything about the chapter</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Sparkles className="w-12 h-12 text-hog-orange-500 mb-4" />
              <h2 className="text-lg font-display font-semibold mb-2">
                Welcome to the Chapter Assistant!
              </h2>
              <p className="text-hog-black-400 mb-6 max-w-md">
                I can help you with questions about chapter activities, rides, meetings,
                HOG membership, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                {suggestedQuestions.map((question, i) => (
                  <button
                    key={i}
                    className="p-3 text-sm text-left rounded-lg bg-hog-black-800 hover:bg-hog-black-700 transition-colors"
                    onClick={() => {
                      setMessages([{ role: 'user', content: question }]);
                      chatMutation.mutate(question);
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={clsx(
                    'flex gap-3',
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      message.role === 'user'
                        ? 'bg-hog-orange-500'
                        : 'bg-hog-black-700'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-hog-orange-500" />
                    )}
                  </div>
                  <div
                    className={clsx(
                      'max-w-[80%] rounded-xl px-4 py-2',
                      message.role === 'user'
                        ? 'bg-hog-orange-500 text-white'
                        : 'bg-hog-black-800 text-hog-black-100'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-hog-black-700 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-hog-orange-500" />
                  </div>
                  <div className="bg-hog-black-800 rounded-xl px-4 py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-hog-orange-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-hog-black-800">
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={chatMutation.isPending}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!input.trim() || chatMutation.isPending}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
