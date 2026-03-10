"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

interface Caption {
  platform: string;
  caption: string;
  charCount: number;
}

interface GenerationResult {
  captions: Caption[];
  summary: string;
}

const PLATFORM_CONFIG: Record<
  string,
  { icon: string; color: string; maxChars: number }
> = {
  Instagram: { icon: "📸", color: "from-pink-500 to-purple-500", maxChars: 2200 },
  LinkedIn: { icon: "💼", color: "from-blue-600 to-blue-800", maxChars: 3000 },
  TikTok: { icon: "🎵", color: "from-gray-900 to-black", maxChars: 2200 },
  "Twitter/X": { icon: "𝕏", color: "from-gray-800 to-black", maxChars: 280 },
  Facebook: { icon: "👥", color: "from-blue-500 to-blue-700", maxChars: 63206 },
};

const CREDIT_PACKAGES = [
  { id: "10_credits", credits: 10, price: 299, label: "10 credits", popular: false },
  { id: "50_credits", credits: 50, price: 999, label: "50 credits", popular: true },
  { id: "150_credits", credits: 150, price: 1999, label: "150 credits", popular: false },
];

export default function Home() {
  const { isSignedIn, user } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ base64: string; mediaType: string } | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch credits from server when signed in
  useEffect(() => {
    if (!isSignedIn) {
      setCredits(null);
      return;
    }
    fetch("/api/credits")
      .then((res) => res.json())
      .then((data) => setCredits(data.credits))
      .catch(() => setCredits(0));
  }, [isSignedIn, user]);

  // Refresh credits after Stripe redirect (retry to allow webhook time to process)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchased")) {
      window.history.replaceState({}, "", "/");

      const fetchCredits = () =>
        fetch("/api/credits")
          .then((res) => res.json())
          .then((data) => setCredits(data.credits));

      // Fetch immediately, then retry after 2s and 5s to catch webhook delay
      fetchCredits();
      setTimeout(fetchCredits, 2000);
      setTimeout(fetchCredits, 5000);
    }
    if (params.get("canceled")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleBuyCredits = async (packageId: string) => {
    setCheckoutLoading(packageId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout");
      }
    } catch {
      setError("Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB");
      return;
    }

    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImage(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type as string;
      setImageFile({ base64, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleGenerate = async () => {
    if (!imageFile) return;
    if (!isSignedIn) return;
    if (credits !== null && credits <= 0) {
      setError("No credits remaining. Add more credits to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageFile.base64,
          mediaType: imageFile.mediaType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResult({ captions: data.captions, summary: data.summary });
      if (data.credits !== undefined) setCredits(data.credits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const reset = () => {
    setImage(null);
    setImageFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-gray-950/70 border-b border-slate-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              CaptionCraft
            </span>
          </h1>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                {credits !== null && (
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-gray-800 rounded-full px-3 py-1.5 text-sm font-medium">
                    <span className="text-amber-500">&#9733;</span>
                    <span>{credits} credits</span>
                  </div>
                )}
                <Link
                  href="/history"
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
                >
                  History
                </Link>
                <button
                  onClick={() => setShowPricing(true)}
                  className="text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-full px-3 py-1.5 font-medium transition-colors"
                >
                  + Buy credits
                </button>
                <UserButton />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-full px-4 py-2 font-medium transition-colors">
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Sign-in prompt for unauthenticated users */}
        {!isSignedIn && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-5 gap-2 text-center">
              {Object.entries(PLATFORM_CONFIG).map(([name, config]) => (
                <div key={name} className="space-y-1">
                  <div className="text-2xl">{config.icon}</div>
                  <p className="text-[10px] text-slate-400 font-medium">{name}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                One screenshot. Five platforms.
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Upload any product screenshot, content, or moment — get
                copy-paste captions tailored for each social platform in seconds.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { n: "1", t: "Upload", d: "Drop any screenshot" },
                { n: "2", t: "Generate", d: "AI crafts 5 captions" },
                { n: "3", t: "Post", d: "Copy & paste anywhere" },
              ].map((step) => (
                <div
                  key={step.n}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-gray-800/50"
                >
                  <div className="w-6 h-6 mx-auto rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 text-xs font-bold flex items-center justify-center mb-2">
                    {step.n}
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{step.t}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{step.d}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <SignInButton mode="modal">
                <button className="bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white rounded-xl px-8 py-3.5 font-semibold transition-all active:scale-[0.98] text-base">
                  Get started — 5 free credits
                </button>
              </SignInButton>
            </div>
          </div>
        )}

        {/* Authenticated content */}
        {isSignedIn && (<>
          {/* Upload Area */}
          {!image ? (
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                  : "border-slate-300 dark:border-gray-700 hover:border-violet-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
              />
              <div className="space-y-4 cursor-pointer">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-violet-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    Upload your screenshot
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Tap to browse or drag & drop — PNG, JPG, WebP up to 10MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {/* Image Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-gray-800">
                <img
                  src={image}
                  alt="Uploaded screenshot"
                  className="w-full max-h-72 object-contain"
                />
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Generate Button */}
              {!result && (
                <button
                  onClick={handleGenerate}
                  disabled={loading || (credits !== null && credits <= 0)}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] text-base"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="w-5 h-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Analyzing & Crafting...
                    </span>
                  ) : (
                    `Generate Captions (1 credit)`
                  )}
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{result.summary}</p>
                <button
                  onClick={reset}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  New image
                </button>
              </div>

              {result.captions.map((cap, i) => {
                const config = PLATFORM_CONFIG[cap.platform];
                return (
                  <div
                    key={cap.platform}
                    className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div
                      className={`bg-gradient-to-r ${config?.color || "from-gray-500 to-gray-700"} px-4 py-2 flex items-center justify-between`}
                    >
                      <span className="text-white font-medium text-sm flex items-center gap-2">
                        <span>{config?.icon}</span>
                        {cap.platform}
                      </span>
                      <span className="text-white/70 text-xs">
                        {cap.charCount}
                        {config?.maxChars ? `/${config.maxChars}` : ""} chars
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {cap.caption}
                      </p>
                      <button
                        onClick={() => copyToClipboard(cap.caption, i)}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                      >
                        {copiedIndex === i ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy caption
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state for signed-in users */}
          {!image && (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-5 gap-2 text-center">
                {Object.entries(PLATFORM_CONFIG).map(([name, config]) => (
                  <div key={name} className="space-y-1">
                    <div className="text-2xl">{config.icon}</div>
                    <p className="text-[10px] text-slate-400 font-medium">{name}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  One screenshot. Five platforms.
                </h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Upload any product screenshot, content, or moment — get
                  copy-paste captions tailored for each social platform in seconds.
                </p>
              </div>
            </div>
          )}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-center gap-4 text-xs text-slate-400">
        <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
      </footer>

      {/* Pricing Modal */}
      {showPricing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPricing(false);
          }}
        >
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Buy Credits
              </h2>
              <button
                onClick={() => setShowPricing(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center text-slate-500 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleBuyCredits(pkg.id)}
                  disabled={checkoutLoading !== null}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    pkg.popular
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                      : "border-slate-200 dark:border-gray-700 hover:border-violet-300"
                  } ${checkoutLoading === pkg.id ? "opacity-60" : ""}`}
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {pkg.credits} credits
                      </span>
                      {pkg.popular && (
                        <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full uppercase">
                          Best value
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      ${(pkg.price / 100 / pkg.credits).toFixed(2)} per caption
                    </span>
                  </div>
                  <div className="text-right">
                    {checkoutLoading === pkg.id ? (
                      <svg
                        className="w-5 h-5 animate-spin text-violet-600"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        ${(pkg.price / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-4">
              Secure payment via Stripe. Credits never expire.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
