import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(), deleteUser: vi.fn(), from: vi.fn(), upsert: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: mocks }, from: mocks.from },
}));
import { createManagedUser } from "./managed-user.server";

const input = { email: "bruna.roque@step-og.com", password: "test-only-password", fullName: "Test", role: "pm" as const };

describe("managed user provisioning", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
  });
  it("creates the account without a second getUser or function invocation", async () => {
    await expect(createManagedUser(input)).resolves.toBe("new-user");
    expect(mocks.createUser).toHaveBeenCalledWith({ email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: "Test" } });
    expect(mocks.from).toHaveBeenCalledWith("user_roles");
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.upsert).toHaveBeenNthCalledWith(1, {
      id: "new-user", email: input.email, full_name: "Test", must_change_password: true, perfil: null,
    }, { onConflict: "id" });
    expect(mocks.upsert).toHaveBeenNthCalledWith(2, { user_id: "new-user", role: "pm" }, {
      onConflict: "user_id,role", ignoreDuplicates: true,
    });
  });
  it("provisions a verified Intranet account without a password and with a pending role", async () => {
    await expect(createManagedUser({ email: input.email, fullName: "Test", role: "pending", stepOneUserId: "step-user" }))
      .resolves.toBe("new-user");
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: input.email, email_confirm: true, user_metadata: { full_name: "Test", step_one_user_id: "step-user" },
    });
    expect(mocks.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ must_change_password: false }), { onConflict: "id" });
    expect(mocks.upsert).toHaveBeenNthCalledWith(2, { user_id: "new-user", role: "pending" }, {
      onConflict: "user_id,role", ignoreDuplicates: true,
    });
  });
  it("does not alter an existing account on duplicate email", async () => {
    mocks.createUser.mockResolvedValue({ data: { user: null }, error: { message: "User already registered" } });
    await expect(createManagedUser(input)).rejects.toThrow("User already registered");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("rolls back the new account on a provisioning error", async () => {
    mocks.upsert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "write failed" } });
    await expect(createManagedUser(input)).rejects.toThrow("write failed");
    expect(mocks.deleteUser).toHaveBeenCalledWith("new-user");
  });
});
