import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
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
        // Adjuntar id_token para validación backend
        (token as any).google_id_token = (account as any).id_token;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).google_sub = (token as any).google_sub;
      (session as any).google_id_token = (token as any).google_id_token;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
