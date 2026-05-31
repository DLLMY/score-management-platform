import { Page } from '@playwright/test';

export class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[id="username"]');
    this.passwordInput = page.locator('input[name="password"], input[id="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.text-red-500, .error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }
}

export class DashboardPage {
  constructor(page) {
    this.page = page;
    this.sidebar = page.locator('aside');
    this.userMenu = page.locator('button:has-text("Admin"), button:has-text("管理员")');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectSidebar() {
    await expect(this.sidebar).toBeVisible();
  }
}

export class UserListPage {
  constructor(page) {
    this.page = page;
    this.table = page.locator('table');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("添加")');
    this.searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="搜索"]');
  }

  async goto() {
    await this.page.goto('/users');
  }

  async expectTable() {
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }

  async search(term) {
    await this.searchInput.fill(term);
  }
}

export class DeviceListPage {
  constructor(page) {
    this.page = page;
    this.table = page.locator('table, .device-list');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("添加")');
  }

  async goto() {
    await this.page.goto('/devices');
  }

  async expectTable() {
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }
}

export class RulesListPage {
  constructor(page) {
    this.page = page;
    this.table = page.locator('table, .rules-list');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("添加")');
  }

  async goto() {
    await this.page.goto('/rules');
  }

  async expectTable() {
    await expect(this.table).toBeVisible({ timeout: 10000 });
  }
}
