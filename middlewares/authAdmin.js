import { clerkClient } from "@clerk/nextjs/server"

const authAdmin = async (userId) => {
  try {
    if (!userId) return false

    const user = await clerkClient.users.getUser(userId)
    const email = user.emailAddresses?.[0]?.emailAddress
    if (!email) return false

    return process.env.ADMIN_EMAIL?.split(',').includes(email) ?? false
  } catch (error) {
    console.error('AuthAdmin Error:', error)
    return false
  }
}

export default authAdmin
