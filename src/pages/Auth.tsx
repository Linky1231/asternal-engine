import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Mail, UserX, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      console.log("signed in");
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-mesh relative overflow-hidden">
      {/* ── Ambient glass orbs ── */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent glass-orb-1 pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tr from-accent/8 via-primary/5 to-transparent glass-orb-2 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-gradient-to-bl from-primary/6 to-accent/4 glass-orb-3 pointer-events-none" />

      {/* ── Auth Content ── */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="flex items-center justify-center h-full flex-col px-4">
          <Card className="min-w-[360px] max-w-[400px] border-0 shadow-glass-lg glass overflow-hidden">
            {/* Glass sheen overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 to-transparent rounded-[inherit]" />

            {step === "signIn" ? (
              <>
                <CardHeader className="text-center relative z-10 pt-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_8px_24px_-6px_oklch(0.54_0.175_255/0.5)] mb-5 cursor-pointer mx-auto group transition-transform hover:scale-105 duration-300" onClick={() => navigate("/")}>
                        <img
                          src={logo}
                          alt="Logo"
                          width={40}
                          height={40}
                          className="brightness-0 invert"
                        />
                      </div>
                      {/* Glow ring */}
                      <div className="absolute -inset-2 rounded-[20px] bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-40 blur-md animate-pulse" style={{ animationDuration: "3s" }} />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-display font-semibold tracking-tight">Welcome to Asternal</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/70 mt-1 max-w-[260px] mx-auto leading-relaxed">
                    Enter your email to log in or create your account
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="space-y-4 relative z-10 px-6">
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-10 h-11 rounded-xl bg-white/60 border-glass-border backdrop-blur-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                        className="h-11 w-11 rounded-xl glass border-glass-border hover:bg-white/70 transition-all shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="text-sm text-destructive/80 text-center bg-destructive/5 rounded-lg px-3 py-2 border border-destructive/10">{error}</p>
                    )}

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-glass px-3 text-muted-foreground/50 font-medium tracking-wider">
                          or
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-xl glass border-glass-border hover:bg-white/70 transition-all text-sm font-medium"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-primary" />
                      Continue as Guest
                    </Button>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center relative z-10 pt-8">
                  <div className="flex justify-center mb-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 grid place-items-center border border-primary/10">
                      <Mail size={28} className="text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg font-display">Check your email</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/70 mt-0.5">
                    We sent a code to<br />
                    <span className="font-medium text-foreground/80">{step.email}</span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4 relative z-10 px-6">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center my-4">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2 flex">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="w-11 h-12 rounded-xl glass border-glass-border text-lg font-semibold focus:border-primary/40 transition-all"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="text-sm text-destructive/80 text-center bg-destructive/5 rounded-lg px-3 py-2 border border-destructive/10">
                        {error}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 text-center mt-4">
                      Didn't receive a code?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-primary font-medium hover:underline"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2 px-6 pb-6 relative z-10">
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-display tracking-wider shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full h-10 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            {/* Footer */}
            <div className="relative z-10 py-3.5 px-6 text-[11px] text-center text-muted-foreground/50 border-t border-border/30 bg-glass backdrop-blur-sm rounded-b-[inherit]">
              Secured by{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors font-medium"
              >
                freebuff.com
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
