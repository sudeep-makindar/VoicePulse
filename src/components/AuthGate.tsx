import React from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { Fingerprint, Chrome } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  return (
    <>
      {/* If the user is signed out, block access and present styled sign-in options */}
      <Show when="signed-out">
        <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,255,0,0.03),transparent_60%)] pointer-events-none" />
          
          <div className="w-full max-w-md glass border border-brand-acid/20 rounded-2xl p-8 flex flex-col gap-6 text-center z-10 shadow-[0_0_30px_rgba(200,255,0,0.04)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-brand-acid/10 border border-brand-acid/25 flex items-center justify-center text-brand-acid shadow-[0_0_20px_rgba(200,255,0,0.1)]">
                <Fingerprint size={32} className="animate-pulse" />
              </div>
              <h2 className="text-3xl font-display text-white tracking-widest mt-2">VOICEPULSE AUTH</h2>
              <p className="text-xs font-mono text-brand-acid/80 uppercase">Secured by Clerk Google Auth</p>
            </div>

            <div className="flex flex-col gap-4 text-left my-2">
              <p className="text-sm text-brand-muted font-body leading-relaxed">
                Welcome back operator. Please verify your Google credentials to launch VoicePulse feedback portal and sessions.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <SignInButton mode="modal">
                <button className="w-full py-4 bg-brand-acid text-brand-dark font-bold font-mono text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(200,255,0,0.2)] hover:shadow-[0_0_25px_rgba(200,255,0,0.35)] transition-all">
                  <Chrome size={16} />
                  <span>SIGN IN WITH GOOGLE CLERK</span>
                </button>
              </SignInButton>
              
              <SignUpButton mode="modal">
                <button className="w-full py-3 bg-brand-surface border border-white/10 hover:border-brand-acid/30 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all font-mono text-xs uppercase">
                  <span>Create Account</span>
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </Show>

      {/* If signed in, render the application payload */}
      <Show when="signed-in">
        {children}
      </Show>
    </>
  );
}

// User Profile Avatar controls
export function AuthUserButton() {
  return (
    <div className="flex items-center gap-3">
      <UserButton />
    </div>
  );
}
