import { ApiError } from "../utils/ApiError";

// ─── Mock Prisma ───────────────────────────────────────────────────────────────
const mockTx = {
  product: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  inventoryLog: {
    create: jest.fn(),
  },
  order: {
    create: jest.fn(),
  },
};

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
    ),
  },
}));

// ─── Import after mock ─────────────────────────────────────────────────────────
import {
  reserveProduct,
  completeCheckout,
} from "../services/reservation.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────────
const PRODUCT = {
  id: "product-1",
  name: "Air Jordan 1",
  description: "Limited drop",
  price: "180.00",
  totalStock: 10,
  availableStock: 3,
  version: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const RESERVATION = {
  id: "reservation-1",
  userId: "user-1",
  productId: "product-1",
  quantity: 1,
  status: "PENDING" as const,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  createdAt: new Date(),
};

const ORDER = {
  id: "order-1",
  userId: "user-1",
  productId: "product-1",
  reservationId: "reservation-1",
  totalAmount: "180.00",
  createdAt: new Date(),
};

// ─── reserveProduct ────────────────────────────────────────────────────────────
describe("reserveProduct", () => {
  beforeEach(() => {
    mockTx.product.findUnique.mockResolvedValue(PRODUCT);
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
    mockTx.reservation.create.mockResolvedValue(RESERVATION);
    mockTx.inventoryLog.create.mockResolvedValue({});
  });

  it("creates a reservation and deducts stock on success", async () => {
    const result = await reserveProduct("user-1", {
      productId: "product-1",
      quantity: 1,
    });

    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: "product-1",
        version: PRODUCT.version,
        availableStock: { gte: 1 },
      },
      data: {
        availableStock: { decrement: 1 },
        version: { increment: 1 },
      },
    });

    expect(mockTx.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          productId: "product-1",
          quantity: 1,
        }),
      }),
    );

    expect(mockTx.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "product-1",
          change: -1,
        }),
      }),
    );

    expect(result).toMatchObject({ id: "reservation-1", status: "PENDING" });
  });

  it("sets expiresAt to ~5 minutes from now", async () => {
    const before = Date.now();
    await reserveProduct("user-1", { productId: "product-1", quantity: 1 });
    const after = Date.now();

    const call = mockTx.reservation.create.mock.calls[0][0];
    const expiresAt: Date = call.data.expiresAt;
    const diff = expiresAt.getTime() - before;

    expect(diff).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100);
    expect(diff).toBeLessThanOrEqual(5 * 60 * 1000 + (after - before) + 100);
  });

  it("throws 404 when product does not exist", async () => {
    mockTx.product.findUnique.mockResolvedValue(null);

    await expect(
      reserveProduct("user-1", { productId: "product-1", quantity: 1 }),
    ).rejects.toMatchObject({ status: 404, message: "Product not found" });
  });

  it("throws 409 when availableStock is less than quantity", async () => {
    mockTx.product.findUnique.mockResolvedValue({
      ...PRODUCT,
      availableStock: 0,
    });

    await expect(
      reserveProduct("user-1", { productId: "product-1", quantity: 1 }),
    ).rejects.toMatchObject({ status: 409, message: "Insufficient stock" });
  });

  it("throws 409 on version conflict (optimistic lock failure)", async () => {
    // Another request already incremented the version — updateMany finds 0 rows
    mockTx.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reserveProduct("user-1", { productId: "product-1", quantity: 1 }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("conflict"),
    });
  });

  it("errors are instances of ApiError", async () => {
    mockTx.product.findUnique.mockResolvedValue(null);

    const error = await reserveProduct("user-1", {
      productId: "product-1",
      quantity: 1,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
  });
});

// ─── completeCheckout ──────────────────────────────────────────────────────────
describe("completeCheckout", () => {
  beforeEach(() => {
    mockTx.reservation.findUnique.mockResolvedValue({
      ...RESERVATION,
      product: PRODUCT,
    });
    mockTx.order.create.mockResolvedValue(ORDER);
    mockTx.reservation.update.mockResolvedValue({
      ...RESERVATION,
      status: "COMPLETED",
    });
  });

  it("creates an order and marks reservation COMPLETED", async () => {
    const result = await completeCheckout("reservation-1", "user-1");

    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          productId: "product-1",
          reservationId: "reservation-1",
        }),
      }),
    );

    expect(mockTx.reservation.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: { status: "COMPLETED" },
    });

    expect(result.order).toMatchObject({ id: "order-1" });
    expect(result.reservation).toMatchObject({ status: "COMPLETED" });
  });

  it("calculates totalAmount as price × quantity", async () => {
    await completeCheckout("reservation-1", "user-1");

    const call = mockTx.order.create.mock.calls[0][0];
    // price: 180.00, quantity: 1
    expect(call.data.totalAmount).toBe("180");
  });

  it("throws 404 when reservation does not exist", async () => {
    mockTx.reservation.findUnique.mockResolvedValue(null);

    await expect(
      completeCheckout("reservation-1", "user-1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 403 when reservation belongs to a different user", async () => {
    mockTx.reservation.findUnique.mockResolvedValue({
      ...RESERVATION,
      product: PRODUCT,
      userId: "other-user",
    });

    await expect(
      completeCheckout("reservation-1", "user-1"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("throws 409 when reservation is already COMPLETED", async () => {
    mockTx.reservation.findUnique.mockResolvedValue({
      ...RESERVATION,
      product: PRODUCT,
      status: "COMPLETED",
    });

    await expect(
      completeCheckout("reservation-1", "user-1"),
    ).rejects.toMatchObject({
      status: 409,
      message: "Reservation is COMPLETED",
    });
  });

  it("throws 409 when reservation is EXPIRED", async () => {
    mockTx.reservation.findUnique.mockResolvedValue({
      ...RESERVATION,
      product: PRODUCT,
      status: "EXPIRED",
    });

    await expect(
      completeCheckout("reservation-1", "user-1"),
    ).rejects.toMatchObject({
      status: 409,
      message: "Reservation is EXPIRED",
    });
  });

  it("throws 409 when reservation timer has elapsed", async () => {
    mockTx.reservation.findUnique.mockResolvedValue({
      ...RESERVATION,
      product: PRODUCT,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    });

    await expect(
      completeCheckout("reservation-1", "user-1"),
    ).rejects.toMatchObject({
      status: 409,
      message: "Reservation has expired",
    });
  });
});
