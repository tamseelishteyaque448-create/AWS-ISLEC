import { expect, test } from "./fixtures/roles";
import { expectLocalDisposableTarget } from "./fixtures/target";

test("authenticated non-admin is denied access to admin project review", async ({ nonAdminPage }) => {
  await expectLocalDisposableTarget(nonAdminPage);

  await nonAdminPage.goto("/admin/projects");

  await expect(nonAdminPage).toHaveURL(/\/member$/);
  await expect(nonAdminPage.getByRole("heading", { name: "Projects, thoughtfully run." })).toHaveCount(0);
});
