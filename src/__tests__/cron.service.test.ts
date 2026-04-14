// ─── Mock node-cron ───────────────────────────────────────────────────────────
// Capture the scheduled callback so we can trigger it manually in tests
let cronCallback: (() => Promise<void>) | null = null;

jest.mock("node-cron", () => ({
  schedule: jest.fn((_expression: string, cb: () => Promise<void>) => {
    cronCallback = cb;
  }),
}));

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockTx = {
  reservation: { updateMany: jest.fn() },
  product: { update: jest.fn() },
  inventoryLog: { create: jest.fn() },
};

const mockPrisma = {
  reservation: { findMany: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
};

jest.mock("../config/db", () => ({
  __esModule: true,
  default: mockPrisma,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { startExpiryJob } from "../services/cron.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const triggerCron = async () => {
  if (!cronCallback) throw new Error("Cron not scheduled — call startExpiryJob() first");
  await cronCallback();
};

const expiredReservation = (id: string, productId: string, quantity: number) => ({
  id,
  productId,
  quantity,
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("startExpiryJob", () => {
  beforeAll(() => {
    startExpiryJob();
  });

  beforeEach(() => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);
    mockTx.reservation.updateMany.mockResolvedValue({ count: 1 });
    mockTx.product.update.mockResolvedValue({});
    mockTx.inventoryLog.create.mockResolvedValue({});
  });

  it("registers a cron schedule on startup", () => {
    // cronCallback is set when startExpiryJob() called schedule()
    // (clearMocks resets mock.calls, but our module-level variable persists)
    expect(cronCallback).not.toBeNull();
  });

  it("does nothing when there are no expired reservations", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);

    await triggerCron();

    expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
    expect(mockTx.product.update).not.toHaveBeenCalled();
  });

  it("queries for PENDING reservations past their expiresAt", async () => {
    await triggerCron();

    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PENDING",
          expiresAt: { lt: expect.any(Date) },
        },
      }),
    );
  });

  it("marks each expired reservation as EXPIRED", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-1", "prod-1", 2),
    ]);

    await triggerCron();

    expect(mockTx.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: "res-1", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  });

  it("restores availableStock for each expired reservation", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-1", "prod-1", 3),
    ]);

    await triggerCron();

    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { availableStock: { increment: 3 } },
    });
  });

  it("writes an InventoryLog entry for each expiry", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-1", "prod-1", 2),
    ]);

    await triggerCron();

    expect(mockTx.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "prod-1",
          change: 2,
          reason: expect.stringContaining("expired"),
        }),
      }),
    );
  });

  it("processes multiple expired reservations in one run", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-1", "prod-1", 1),
      expiredReservation("res-2", "prod-2", 5),
      expiredReservation("res-3", "prod-1", 2),
    ]);

    await triggerCron();

    expect(mockTx.reservation.updateMany).toHaveBeenCalledTimes(3);
    expect(mockTx.product.update).toHaveBeenCalledTimes(3);
    expect(mockTx.inventoryLog.create).toHaveBeenCalledTimes(3);
  });

  it("skips stock restore if reservation was already checked out (count 0)", async () => {
    // Simulates the race: user checked out just before cron ran
    mockTx.reservation.updateMany.mockResolvedValue({ count: 0 });

    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-1", "prod-1", 1),
    ]);

    await triggerCron();

    // updateMany was called but returned 0 — stock must NOT be restored
    expect(mockTx.reservation.updateMany).toHaveBeenCalled();
    expect(mockTx.product.update).not.toHaveBeenCalled();
    expect(mockTx.inventoryLog.create).not.toHaveBeenCalled();
  });

  it("continues processing other reservations if one transaction fails", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      expiredReservation("res-fail", "prod-1", 1),
      expiredReservation("res-ok", "prod-2", 1),
    ]);

    // First transaction throws, second succeeds
    mockPrisma.$transaction
      .mockRejectedValueOnce(new Error("DB timeout"))
      .mockImplementationOnce((cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx),
      );

    // Should not throw — Promise.allSettled swallows individual failures
    await expect(triggerCron()).resolves.not.toThrow();
  });
});
