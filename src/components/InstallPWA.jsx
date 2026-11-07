import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    
    if (isStandalone) {
      return; // Already installed
    }

    // For iOS, show instructions after 3 seconds
    if (ios) {
      const timer = setTimeout(() => {
        const hasSeenInstructions = localStorage.getItem('ios-install-seen');
        if (!hasSeenInstructions) {
          setShowInstall(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    // For Android/Desktop
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed successfully');
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  const handleIOSInstructions = () => {
    setShowIOSInstructions(true);
  };

  const dismissInstall = () => {
    setShowInstall(false);
    if (isIOS) {
      localStorage.setItem('ios-install-seen', 'true');
    }
  };

  if (!showInstall) return null;

  return (
    <>
      {/* Main Install Prompt */}
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="bg-white rounded-xl shadow-2xl border border-indigo-200 overflow-hidden animate-slide-up">
          {/* Close Button */}
          <button
            onClick={dismissInstall}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  Install Buildesk CRM
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {isIOS 
                    ? 'Add to your home screen for quick access and offline support'
                    : 'Install the app for instant access, offline support, and push notifications'}
                </p>

                <div className="flex gap-2">
                  {isIOS ? (
                    <button
                      onClick={handleIOSInstructions}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Show Instructions
                    </button>
                  ) : (
                    <button
                      onClick={handleInstall}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Install Now
                    </button>
                  )}
                  <button
                    onClick={dismissInstall}
                    className="px-4 py-2.5 text-gray-600 hover:text-gray-900 rounded-lg text-sm font-medium transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-indigo-50 px-5 py-3 border-t border-indigo-100">
            <div className="flex items-center gap-4 text-xs text-indigo-700">
              <span className="flex items-center gap-1">
                ⚡ Fast Access
              </span>
              <span className="flex items-center gap-1">
                📱 Works Offline
              </span>
              <span className="flex items-center gap-1">
                🔔 Notifications
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Smartphone className="w-6 h-6" />
                Install on iPhone/iPad
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Tap the Share button</p>
                  <p className="text-sm text-gray-600">
                    Tap the <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-blue-500">
                        <path d="M8 1l-1.5 1.5L9.8 5.8H2v2h7.8L6.5 11.1 8 12.6l5.6-5.6L8 1z"/>
                      </svg>
                    </span> button at the bottom of your screen
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Select "Add to Home Screen"</p>
                  <p className="text-sm text-gray-600">
                    Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Confirm installation</p>
                  <p className="text-sm text-gray-600">
                    Tap <span className="font-semibold">"Add"</span> in the top right corner
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <p className="text-sm text-indigo-700">
                  <span className="font-semibold">✨ That's it!</span> The CRM app will appear on your home screen like any other app.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowIOSInstructions(false);
                  dismissInstall();
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
