import { expect, test } from "./fixtures/roles";
import { getDisposableProjectFixtures } from "./fixtures/projects";
import { expectLocalDisposableTarget } from "./fixtures/target";

const projectTitle = "E2E Join Proof Project";
const requestMessage = "I can help validate the project infrastructure.";
const proofTitle = "E2E contributor proof";
const proofUrl = "https://example.test/e2e-contributor-proof";

test("contributor request and URL proof are visible only to the owner", async ({ ownerPage, contributorPage, nonAdminPage }) => {
  const { joinProofProjectId } = getDisposableProjectFixtures();

  await expectLocalDisposableTarget(ownerPage);
  await ownerPage.goto(`/member/projects/${joinProofProjectId}`);
  await expect(ownerPage.getByRole("heading", { name: projectTitle, exact: true, level: 1 })).toBeVisible();

  await expectLocalDisposableTarget(contributorPage);
  await contributorPage.goto(`/member/projects/${joinProofProjectId}`);
  await expect(contributorPage.getByRole("heading", { name: projectTitle, exact: true, level: 1 })).toBeVisible();
  const pendingRequest = contributorPage.getByRole("heading", { name: "Request pending", exact: true });
  if (await pendingRequest.count() === 0) {
    await contributorPage.getByLabel("Contribution area").selectOption({ label: "Backend development" });
    await contributorPage.getByLabel("Message (optional)").fill(requestMessage);
    await contributorPage.getByRole("button", { name: "Send request" }).click();
  }
  await expect(pendingRequest).toBeVisible();
  await expect(contributorPage.getByText(requestMessage, { exact: true })).toBeVisible();

  const contributorProof = contributorPage.getByRole("link", { name: proofUrl, exact: true });
  if (await contributorProof.count() === 0) {
    await contributorPage.getByText("Add a proof", { exact: true }).click();
    await contributorPage.getByLabel("Title").fill(proofTitle);
    await contributorPage.getByLabel("URL").fill(proofUrl);
    await contributorPage.getByRole("button", { name: "Add proof", exact: true }).click();
  }
  await expect(contributorProof).toBeVisible();

  await ownerPage.reload();
  await ownerPage.getByRole("tab", { name: "Team", exact: true }).click();
  const requests = ownerPage.locator(".workspace-request");
  await expect(requests).toHaveCount(1);
  await expect(requests.first()).toContainText(requestMessage);
  await expect(requests.first().getByRole("link", { name: proofTitle, exact: true })).toHaveAttribute("href", proofUrl);

  // The single RLS-backed owner workspace row is the persisted database state;
  // a contributor refresh must not recreate a second pending request.
  await contributorPage.reload();
  await expect(contributorPage.getByRole("heading", { name: "Request pending", exact: true })).toBeVisible();
  await ownerPage.reload();
  await ownerPage.getByRole("tab", { name: "Team", exact: true }).click();
  await expect(ownerPage.locator(".workspace-request")).toHaveCount(1);

  await expectLocalDisposableTarget(nonAdminPage);
  await nonAdminPage.goto(`/member/projects/${joinProofProjectId}`);
  await expect(nonAdminPage.getByRole("heading", { name: projectTitle, exact: true, level: 1 })).toBeVisible();
  await expect(nonAdminPage.getByText(requestMessage, { exact: true })).toHaveCount(0);
  await expect(nonAdminPage.getByRole("link", { name: proofTitle, exact: true })).toHaveCount(0);
  await expect(nonAdminPage.getByText(proofUrl, { exact: true })).toHaveCount(0);
});
