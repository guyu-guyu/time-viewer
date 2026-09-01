import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: "" } }, // 只要身份，不要任何仓库权限
    }),
  ],
  callbacks: {
    // 白名单：比对数字 id（永久不变），不是 login 用户名（可改）
    async signIn({ account }) {
      return (
        account?.provider === "github" &&
        String(account.providerAccountId) === process.env.OWNER_GITHUB_ID
      );
    },
  },
});
