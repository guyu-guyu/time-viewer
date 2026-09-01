import { LoginButton } from "./login-button";

export const metadata = { title: "登录 · time-viewer" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">time-viewer</h1>
        <p className="text-sm text-muted-foreground">仅限所有者访问</p>
        <LoginButton />
      </div>
    </main>
  );
}
