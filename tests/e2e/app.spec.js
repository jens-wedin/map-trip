import { test, expect } from "@playwright/test";

test.describe("Roadtrip Planner - Basic UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map");
  });

  test("loads with default stops (Stockholm and Paris)", async ({ page }) => {
    const stops = page.locator(".stop-item");
    await expect(stops).toHaveCount(2);

    const firstStop = stops.nth(0).locator(".stop-input");
    const secondStop = stops.nth(1).locator(".stop-input");
    await expect(firstStop).toHaveValue("Stockholm, Sweden");
    await expect(secondStop).toHaveValue("Paris, France");
  });

  test("shows subtitle with route endpoints", async ({ page }) => {
    const subtitle = page.locator("#subtitle");
    await expect(subtitle).toContainText("Stockholm");
    await expect(subtitle).toContainText("Paris");
  });

  test("car type selector defaults to gasoline", async ({ page }) => {
    const carType = page.locator("#car-type");
    await expect(carType).toHaveValue("gasoline");
  });

  test("has three car type options", async ({ page }) => {
    const options = page.locator("#car-type option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAttribute("value", "gasoline");
    await expect(options.nth(1)).toHaveAttribute("value", "diesel");
    await expect(options.nth(2)).toHaveAttribute("value", "electric");
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.click("#theme-toggle");
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.click("#theme-toggle");
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("can remove a stop", async ({ page }) => {
    const removeButtons = page.locator(".stop-remove");
    await removeButtons.first().click();

    const stops = page.locator(".stop-item");
    await expect(stops).toHaveCount(1);
  });
});

test.describe("Roadtrip Planner - Route Calculation", () => {
  test.beforeEach(async ({ page }) => {
    // Mock OSRM routing API
    await page.route("**/router.project-osrm.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 1870000,
              duration: 72000,
              geometry: {
                type: "LineString",
                coordinates: [
                  [18.0686, 59.3293],
                  [15.0, 56.0],
                  [12.0, 54.0],
                  [10.0, 53.5],
                  [8.0, 52.0],
                  [5.0, 50.0],
                  [3.0, 49.0],
                  [2.3522, 48.8566],
                ],
              },
            },
          ],
        }),
      });
    });

    await page.goto("/");
    await page.waitForSelector("#map");
  });

  test("calculates route and shows summary", async ({ page }) => {
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#route-total")).toContainText("km");
  });

  test("shows route segments", async ({ page }) => {
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    const segments = page.locator(".segment");
    await expect(segments.first()).toBeVisible();
  });

  test("shows cost when price per km is set", async ({ page }) => {
    await page.fill("#price-per-km", "0.15");
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#route-cost")).toBeVisible();
    await expect(page.locator(".cost-value")).toContainText("$");
  });

  test("hides cost when no price is set", async ({ page }) => {
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#route-cost")).toBeHidden();
  });
});

test.describe("Roadtrip Planner - Tesla Charging Points", () => {
  const mockChargerResponse = [
    {
      ID: 101,
      AddressInfo: {
        Title: "Tesla Supercharger Hamburg",
        AddressLine1: "Hauptstrasse 1",
        Town: "Hamburg",
        Country: { Title: "Germany" },
        Latitude: 53.55,
        Longitude: 10.0,
      },
      NumberOfPoints: 12,
      Connections: [
        { ConnectionType: { Title: "Tesla Supercharger (Model S/X)" } },
        { ConnectionType: { Title: "CCS (Type 2)" } },
      ],
    },
    {
      ID: 102,
      AddressInfo: {
        Title: "Tesla Supercharger Copenhagen",
        AddressLine1: "Vesterbrogade 10",
        Town: "Copenhagen",
        Country: { Title: "Denmark" },
        Latitude: 55.67,
        Longitude: 12.57,
      },
      NumberOfPoints: 8,
      Connections: [
        { ConnectionType: { Title: "Tesla Supercharger (Model S/X)" } },
      ],
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock OSRM routing API
    await page.route("**/router.project-osrm.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 1870000,
              duration: 72000,
              geometry: {
                type: "LineString",
                coordinates: [
                  [18.0686, 59.3293],
                  [15.0, 56.0],
                  [12.0, 54.0],
                  [10.0, 53.5],
                  [8.0, 52.0],
                  [5.0, 50.0],
                  [3.0, 49.0],
                  [2.3522, 48.8566],
                ],
              },
            },
          ],
        }),
      });
    });

    // Mock Open Charge Map API
    await page.route("**/api.openchargemap.io/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockChargerResponse),
      });
    });

    await page.goto("/");
    await page.waitForSelector("#map");
  });

  test("does NOT show chargers when car type is gasoline", async ({ page }) => {
    await expect(page.locator("#car-type")).toHaveValue("gasoline");
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#charger-status")).toBeHidden();
    await expect(page.locator(".charger-marker")).toHaveCount(0);
  });

  test("shows chargers when car type is electric and route is calculated", async ({
    page,
  }) => {
    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#charger-status")).toContainText(
      "Tesla Supercharger"
    );
    await expect(page.locator(".charger-marker")).toHaveCount(2);
  });

  test("charger markers have correct icon", async ({ page }) => {
    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });

    const marker = page.locator(".charger-marker").first();
    await expect(marker).toBeVisible();
    // Lightning bolt character ⚡
    await expect(marker.locator("div")).toContainText("⚡");
  });

  test("charger popup shows details on click", async ({ page }) => {
    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });

    // Click a charger marker
    await page.locator(".charger-marker").first().click();

    const popup = page.locator(".charger-popup");
    await expect(popup).toBeVisible({ timeout: 5000 });
    await expect(popup.locator("strong")).toContainText("Tesla Supercharger");
    await expect(popup).toContainText("Charging points:");
    await expect(popup).toContainText("Connectors:");
  });

  test("switching to electric after route calc shows chargers", async ({
    page,
  }) => {
    // Calculate with gasoline first
    await page.click("#calculate-btn");
    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".charger-marker")).toHaveCount(0);

    // Switch to electric
    await page.selectOption("#car-type", "electric");

    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#charger-status")).toContainText(
      "Tesla Supercharger"
    );
    await expect(page.locator(".charger-marker")).toHaveCount(2);
  });

  test("switching away from electric clears chargers", async ({ page }) => {
    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".charger-marker")).toHaveCount(2);

    // Switch to diesel
    await page.selectOption("#car-type", "diesel");

    await expect(page.locator("#charger-status")).toBeHidden();
    await expect(page.locator(".charger-marker")).toHaveCount(0);
  });

  test("removing a stop clears chargers", async ({ page }) => {
    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".charger-marker")).toHaveCount(2);

    // Remove a stop
    await page.locator(".stop-remove").first().click();

    await expect(page.locator("#charger-status")).toBeHidden();
    await expect(page.locator(".charger-marker")).toHaveCount(0);
  });

  test("shows loading state while fetching chargers", async ({ page }) => {
    // Add delay to charger API response
    await page.route("**/api.openchargemap.io/**", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockChargerResponse),
      });
    });

    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#charger-status")).toContainText(
      "Loading Tesla chargers..."
    );

    // Eventually shows the count
    await expect(page.locator("#charger-status")).toContainText(
      "Tesla Supercharger",
      { timeout: 10000 }
    );
  });

  test("handles charger API failure gracefully", async ({ page }) => {
    await page.route("**/api.openchargemap.io/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "Internal Server Error",
      });
    });

    await page.selectOption("#car-type", "electric");
    await page.click("#calculate-btn");

    await expect(page.locator("#route-info")).toBeVisible({ timeout: 10000 });
    // Should show status but with 0 chargers (graceful degradation)
    await expect(page.locator("#charger-status")).toBeVisible({ timeout: 10000 });
  });

  test("does NOT show chargers when switching to electric without a route", async ({
    page,
  }) => {
    // No route calculated, just switch to electric
    await page.selectOption("#car-type", "electric");

    // Should not show any charger status or markers
    await expect(page.locator("#charger-status")).toBeHidden();
    await expect(page.locator(".charger-marker")).toHaveCount(0);
  });
});

test.describe("Roadtrip Planner - Add Stop", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Nominatim geocoding API
    await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            display_name: "Hamburg, Germany, Europa",
            lat: "53.5511",
            lon: "9.9937",
          },
        ]),
      });
    });

    await page.goto("/");
    await page.waitForSelector("#map");
  });

  test("adds a new stop via input and button", async ({ page }) => {
    await page.fill("#new-stop-input", "Hamburg");
    await page.click("#add-stop-btn");

    await expect(page.locator(".stop-item")).toHaveCount(3, { timeout: 5000 });
  });

  test("adds a new stop via Enter key", async ({ page }) => {
    await page.fill("#new-stop-input", "Hamburg");
    await page.press("#new-stop-input", "Enter");

    await expect(page.locator(".stop-item")).toHaveCount(3, { timeout: 5000 });
  });

  test("clears input after adding stop", async ({ page }) => {
    await page.fill("#new-stop-input", "Hamburg");
    await page.click("#add-stop-btn");

    await expect(page.locator(".stop-item")).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator("#new-stop-input")).toHaveValue("");
  });
});
