import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/auth/login2",
    error: "/auth/login2",
  },

  callbacks: {
    async jwt({ token, account }) {
      // Primer login con Google
      if (account) {
        (token as any).google_sub = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).google_sub = (token as any).google_sub;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
