import prisma from "@/lib/prisma";
import { getAuth } from "@clerk/nextjs/server";
import { PaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId, has } = getAuth(request);
    if (!userId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

    const { addressId, items, couponCode, paymentMethod } = await request.json();

    if (!addressId || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing order details." }, { status: 400 });
    }

    let coupon = null;
    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 400 });

      if (coupon.forNewUser) {
        const userOrders = await prisma.order.findMany({ where: { userId } });
        if (userOrders.length > 0)
          return NextResponse.json({ error: "Coupon valid for new users only" }, { status: 400 });
      }

      if (coupon.forMember && !has({ plan: "plus" })) {
        return NextResponse.json({ error: "Coupon valid for members only" }, { status: 400 });
      }
    }

    const isPlusMember = has({ plan: "plus" });

    // Group orders by storeId
    const ordersByStore = new Map();
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.id } });
      if (!product) continue;
      const storeId = product.storeId;
      if (!ordersByStore.has(storeId)) ordersByStore.set(storeId, []);
      ordersByStore.get(storeId).push({ ...item, price: product.price });
    }

    let orderIds = [];
    let isShippingFeeAdded = false;

    for (const [storeId, sellerItems] of ordersByStore.entries()) {
      let total = sellerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

      if (coupon) total -= (total * coupon.discount) / 100;
      if (!isPlusMember && !isShippingFeeAdded) {
        total += 5; // shipping
        isShippingFeeAdded = true;
      }

      const order = await prisma.order.create({
        data: {
          userId,
          storeId,
          addressId,
          total: parseFloat(total.toFixed(2)),
          paymentMethod,
          isCouponUsed: !!coupon,
          couponId: coupon ? coupon.id : null, // store only relation id
          orderItems: {
            create: sellerItems.map(item => ({
              productId: item.id,
              quantity: item.quantity,
              price: item.price
            }))
          }
        }
      });

      orderIds.push(order.id);
    }

    // Clear cart
    await prisma.user.update({ where: { id: userId }, data: { cart: {} } });

    return NextResponse.json({ message: "Orders placed successfully", orderIds });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 400 });
  }
}

export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: { include: { product: true } },
        address: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 400 });
  }
}
