import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const ALLOWED_EMAILS = [
  'nwellek@gmail.com',
  'nwellek@duffieldholdings.com',
  'johnson.wes333@gmail.com',
]

const USER_ROLES = {
  'nwellek@gmail.com': 'owner',
  'nwellek@duffieldholdings.com': 'owner',
  'johnson.wes333@gmail.com': 'member',
}

// member = no treasury access
const RESTRICTED_TABS = {
  'member': ['treasury', 'settings'],
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email?.toLowerCase())
    },
    async session({ session }) {
      const email = session?.user?.email?.toLowerCase()
      session.role = USER_ROLES[email] || 'member'
      session.restrictedTabs = RESTRICTED_TABS[session.role] || []
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/denied',
  },
}

export default NextAuth(authOptions)
