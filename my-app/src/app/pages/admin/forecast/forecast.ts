import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

type ForecastTab = 'FORECAST' | 'RECOMMEND';
type MovementType = 'IN' | 'OUT' | 'ADJUST' | 'DISCARD';

interface DishForecastRow {
  itemId: string;
  itemCode: string;
  name: string;
  category: string;
  price: number;
  predictedQty: number;
  lowerQty: number;
  upperQty: number;
  forecastDate: string;
  modelVersion: string;
  actionTag: string;
}

interface IngredientForecastRow {
  id: string;
  ingredientCode: string;
  name: string;
  unit: string;
  status: string;
  storageType: string;
  currentStock: number;
  minStockLevel: number;
  predictedDemand: number;
  projectedRemainingStock: number;
  shortfallQty: number;
  recommendedOrderQty: number;
  needsRestock: boolean;
}

interface InventoryAlertRow {
  id: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  alertType: string;
  severity: string;
  status: string;
  message: string;
  generatedAt: string;
}

interface TrendPoint {
  date: string;
  label: string;
  qty: number;
  revenueVnd: number;
  orderLines: number;
}

interface CoOccurringPair {
  rank: number;
  itemA: { id: string; code: string; name: string; category: string };
  itemB: { id: string; code: string; name: string; category: string };
  pairCount: number;
  supportPct: number;
  confidencePct: number;
  lift: number;
}

interface TrendingItem {
  rank?: number;
  id: string;
  code: string;
  name: string;
  category: string;
  qty: number;
  revenueVnd: number;
  trendingScore?: number;
}

interface MlCluster {
  clusterId: string;
  persona_name?: string;
  name: string;
  size: number;
  items: { name: string; code: string; score: number }[];
}

@Component({
  selector: 'app-admin-forecast',
  standalone: false,
  templateUrl: './forecast.html',
  styleUrl: './forecast.css',
})
export class Forecast implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });

  activeTab: ForecastTab = 'FORECAST';
  loading = false;
  savingMovement = false;
  usingFallback = false;
  sourceMode: 'ML_FORECAST' | 'HISTORICAL_FALLBACK' | 'OFFLINE_SAMPLE' = 'OFFLINE_SAMPLE';

  toast = '';
  toastType: 'ok' | 'err' = 'ok';
  dateError = '';

  fromDate = this.todayIso();
  toDate = this.plusDaysIso(6);
  activeRangeDays = 7;

  // Dish filters
  search = '';
  category = 'Tất cả';
  sort = 'default';

  // Ingredient filters & movement modal/drawer
  ingredientFilter: 'ALL' | 'RESTOCK' = 'ALL';
  activeMovementIngredient: IngredientForecastRow | null = null;
  movementType: MovementType = 'IN';
  movementQty = 10;
  movementReason = '';

  dishes: DishForecastRow[] = [];
  ingredients: IngredientForecastRow[] = [];
  alerts: InventoryAlertRow[] = [];
  trend: TrendPoint[] = [];

  // Recommend tab data (UC-35)
  recommendSummary = {
    totalBookingsAnalyzed: 0,
    multiItemBookings: 0,
    multiItemRate: 0,
    totalPairsFound: 0,
    avgBasketItems: 0,
    mlGlobalCount: 0,
    mlClusterCount: 0,
  };
  coOccurringPairs: CoOccurringPair[] = [];
  topTrending: TrendingItem[] = [];
  clusters: MlCluster[] = [];

  private toastTimer?: ReturnType<typeof setTimeout>;
  private readonly refreshListener = () => this.refreshActiveData(true);

  ngOnInit(): void {
    this.seedFallback();
    this.loadForecastBundle();
    this.loadRecommendAnalysis();
    if (typeof window !== 'undefined') {
      window.addEventListener('ken-admin-refresh', this.refreshListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('ken-admin-refresh', this.refreshListener);
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  switchTab(tab: ForecastTab): void {
    this.activeTab = tab;
    if (tab === 'RECOMMEND' && this.coOccurringPairs.length === 0 && this.http) {
      this.loadRecommendAnalysis();
    }
  }

  refreshActiveData(showToast = false): void {
    if (this.activeTab === 'FORECAST') {
      this.loadForecastBundle(showToast);
    } else {
      this.loadRecommendAnalysis(showToast);
    }
  }

  applyQuickRange(days: number): void {
    this.activeRangeDays = days;
    this.fromDate = this.todayIso();
    this.toDate = this.plusDaysIso(days - 1);
    this.dateError = '';
    this.loadForecastBundle();
  }

  onDateChange(field: 'fromDate' | 'toDate', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this[field] = val;
    this.activeRangeDays = 0;
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.dateError = 'Ngày bắt đầu không được lớn hơn ngày kết thúc.';
      return;
    }
    this.dateError = '';
    this.loadForecastBundle();
  }

  loadForecastBundle(showToast = false): void {
    if (this.fromDate > this.toDate) {
      this.dateError = 'Ngày bắt đầu không được lớn hơn ngày kết thúc.';
      return;
    }
    if (!this.http) {
      this.usingFallback = true;
      this.sourceMode = 'OFFLINE_SAMPLE';
      return;
    }

    const trendFrom = this.plusDaysIso(-13);
    const trendTo = this.todayIso();

    this.loading = true;
    forkJoin({
      forecast: this.http
        .get<any>(
          `/api/admin/forecast?from=${encodeURIComponent(this.fromDate)}&to=${encodeURIComponent(this.toDate)}&fallback=true`,
        )
        .pipe(catchError(() => of(null))),
      trends: this.http
        .get<any>(
          `/api/admin/forecast/trends?from=${encodeURIComponent(trendFrom)}&to=${encodeURIComponent(trendTo)}`,
        )
        .pipe(catchError(() => of(null))),
      alerts: this.http
        .get<any>('/api/admin/forecast/alerts?status=OPEN')
        .pipe(catchError(() => of(null))),
    }).subscribe(({ forecast, trends, alerts }) => {
      this.loading = false;

      if (forecast) {
        this.usingFallback = false;
        this.sourceMode = forecast.source === 'HISTORICAL_FALLBACK' ? 'HISTORICAL_FALLBACK' : 'ML_FORECAST';
        this.dishes = Array.isArray(forecast.dishes)
          ? forecast.dishes.map((d: any) => this.normalizeDish(d))
          : [];
        this.ingredients = Array.isArray(forecast.items)
          ? forecast.items.map((ing: any) => this.normalizeIngredient(ing))
          : [];
      } else {
        this.usingFallback = true;
        this.sourceMode = 'OFFLINE_SAMPLE';
      }

      if (trends && Array.isArray(trends.series) && trends.series.length > 0) {
        this.trend = trends.series.slice(-10).map((s: any) => ({
          date: String(s.date ?? ''),
          label: this.shortDate(String(s.date ?? '')),
          qty: Number(s.qty ?? 0),
          revenueVnd: Number(s.revenueVnd ?? 0),
          orderLines: Number(s.orderLines ?? 0),
        }));
      }

      if (alerts && Array.isArray(alerts.items)) {
        this.alerts = alerts.items.map((a: any) => this.normalizeAlert(a));
      }

      if (showToast) {
        this.notify('Đã đồng bộ dữ liệu dự báo & tồn kho');
      }
      this.cdr?.markForCheck();
    });
  }

  loadRecommendAnalysis(showToast = false): void {
    if (!this.http) return;

    this.http
      .get<any>('/api/admin/forecast/recommend-analysis?limit=12')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) return;
        if (res.summary) {
          this.recommendSummary = {
            totalBookingsAnalyzed: Number(res.summary.totalBookingsAnalyzed ?? 0),
            multiItemBookings: Number(res.summary.multiItemBookings ?? 0),
            multiItemRate: Number(res.summary.multiItemRate ?? 0),
            totalPairsFound: Number(res.summary.totalPairsFound ?? 0),
            avgBasketItems: Number(res.summary.avgBasketItems ?? 0),
            mlGlobalCount: Number(res.summary.mlGlobalCount ?? 0),
            mlClusterCount: Number(res.summary.mlClusterCount ?? 0),
          };
        }
        if (Array.isArray(res.coOccurringPairs)) {
          this.coOccurringPairs = res.coOccurringPairs;
        }
        if (Array.isArray(res.topTrending)) {
          this.topTrending = res.topTrending.map((t: any, idx: number) => ({
            rank: Number(t.rank ?? idx + 1),
            id: String(t.itemId ?? t._id ?? t.id ?? ''),
            code: String(t.itemCode ?? t.item_code ?? t.code ?? ''),
            name: String(t.name ?? t.itemName ?? t.item_name ?? ''),
            category: String(t.category ?? 'ADDON'),
            qty: Number(t.totalQty ?? t.qty ?? 0),
            revenueVnd: Number(t.totalRevenue ?? t.revenueVnd ?? 0),
            trendingScore: Number(t.trendingScore ?? t.trending_score ?? t.score ?? 0),
          }));
        }
        if (Array.isArray(res.clusters)) {
          this.clusters = res.clusters.map((c: any, idx: number) => {
            const pName = String(c.persona_name ?? c.name ?? c.cluster_name ?? `Nhóm khách hàng #${idx + 1}`);
            return {
              clusterId: String(c.clusterId ?? c.cluster_id ?? idx),
              persona_name: pName,
              name: pName,
              size: Number(c.size ?? c.customer_count ?? 0),
              items: Array.isArray(c.items) ? c.items : [],
            };
          });
        }
        if (showToast) {
          this.notify('Đã cập nhật phân tích gợi ý bán kèm AI');
        }
        this.cdr?.markForCheck();
      });
  }

  private normalizeDish(d: any): DishForecastRow {
    const models = Array.isArray(d.modelVersions) ? d.modelVersions : [];
    const qty = Number(d.predictedQty ?? 0);
    return {
      itemId: String(d.itemId ?? ''),
      itemCode: String(d.itemCode ?? ''),
      name: String(d.name ?? 'Món không rõ'),
      category: String(d.category ?? 'OTHER').toUpperCase(),
      price: Number(d.price ?? 0),
      predictedQty: qty,
      lowerQty: Number(d.lowerQty ?? 0),
      upperQty: Number(d.upperQty ?? 0),
      forecastDate: String(d.forecastDate ?? this.fromDate),
      modelVersion: String(d.modelVersion ?? models[0] ?? 'HIST_SEASONAL_V1'),
      actionTag: String(d.actionTag ?? d.action_tag ?? (qty >= 50 ? 'Tăng lượng' : 'Giữ nguyên')),
    };
  }

  private normalizeIngredient(ing: any): IngredientForecastRow {
    return {
      id: String(ing._id ?? ing.ingredientId ?? ''),
      ingredientCode: String(ing.ingredientCode ?? ''),
      name: String(ing.name ?? ing.ingredientName ?? ''),
      unit: String(ing.unit ?? 'đv'),
      status: String(ing.status ?? 'ACTIVE'),
      storageType: String(ing.storageType ?? 'AMBIENT'),
      currentStock: Number(ing.currentStock ?? 0),
      minStockLevel: Number(ing.minStockLevel ?? 0),
      predictedDemand: Number(ing.predictedDemand ?? 0),
      projectedRemainingStock: Number(ing.projectedRemainingStock ?? 0),
      shortfallQty: Number(ing.shortfallQty ?? 0),
      recommendedOrderQty: Number(ing.recommendedOrderQty ?? 0),
      needsRestock: Boolean(ing.needsRestock),
    };
  }

  private normalizeAlert(a: any): InventoryAlertRow {
    return {
      id: String(a._id ?? a.id ?? ''),
      ingredientId: String(a.ingredient_id ?? a.ingredientId ?? ''),
      ingredientCode: String(a.ingredient_code ?? a.ingredientCode ?? ''),
      ingredientName: String(a.ingredientName ?? a.ingredient_code ?? ''),
      unit: String(a.unit ?? ''),
      alertType: String(a.alert_type ?? a.alertType ?? 'LOW_STOCK'),
      severity: String(a.severity ?? 'WARNING'),
      status: String(a.status ?? 'OPEN'),
      message: String(a.message ?? 'Tồn kho dưới ngưỡng an toàn'),
      generatedAt: String(a.generated_at ?? a.created_at ?? ''),
    };
  }

  private seedFallback(): void {
    this.dishes = [
      {
        itemId: 'd1',
        itemCode: 'DRK-CF-01',
        name: 'Cà phê Sữa Đá KÉN',
        category: 'DRINK',
        price: 39000,
        predictedQty: 98,
        lowerQty: 84,
        upperQty: 118,
        forecastDate: this.fromDate,
        modelVersion: 'HIST_SEASONAL_V1',
        actionTag: 'Tăng lượng',
      },
      {
        itemId: 'd2',
        itemCode: 'DRK-TEA-02',
        name: 'Trà Đào Cam Sả',
        category: 'DRINK',
        price: 45000,
        predictedQty: 84,
        lowerQty: 70,
        upperQty: 102,
        forecastDate: this.fromDate,
        modelVersion: 'HIST_SEASONAL_V1',
        actionTag: 'Tăng lượng',
      },
      {
        itemId: 'd3',
        itemCode: 'DRK-MAT-03',
        name: 'Matcha Latte Yến Mạch',
        category: 'DRINK',
        price: 55000,
        predictedQty: 66,
        lowerQty: 54,
        upperQty: 82,
        forecastDate: this.fromDate,
        modelVersion: 'HIST_SEASONAL_V1',
        actionTag: 'Tăng lượng',
      },
      {
        itemId: 'd4',
        itemCode: 'CAK-01',
        name: 'Bánh Croissant Bơ Pháp',
        category: 'CAKE',
        price: 38000,
        predictedQty: 44,
        lowerQty: 35,
        upperQty: 55,
        forecastDate: this.fromDate,
        modelVersion: 'HIST_SEASONAL_V1',
        actionTag: 'Giữ nguyên',
      },
      {
        itemId: 'd5',
        itemCode: 'CAK-02',
        name: 'Tiramisu Cacao Mềm',
        category: 'CAKE',
        price: 49000,
        predictedQty: 32,
        lowerQty: 26,
        upperQty: 40,
        forecastDate: this.fromDate,
        modelVersion: 'HIST_SEASONAL_V1',
        actionTag: 'Giảm lượng',
      },
    ];

    this.ingredients = [
      {
        id: 'ing-1',
        ingredientCode: 'ING-CF-ROAST',
        name: 'Hạt Cà phê Arabica Rang',
        unit: 'kg',
        status: 'ACTIVE',
        storageType: 'AMBIENT',
        currentStock: 8.5,
        minStockLevel: 10,
        predictedDemand: 12.4,
        projectedRemainingStock: -3.9,
        shortfallQty: 3.9,
        recommendedOrderQty: 13.9,
        needsRestock: true,
      },
      {
        id: 'ing-2',
        ingredientCode: 'ING-MILK-OAT',
        name: 'Sữa Yến Mạch Oatside 1L',
        unit: 'hộp',
        status: 'ACTIVE',
        storageType: 'CHILLED',
        currentStock: 42,
        minStockLevel: 20,
        predictedDemand: 28,
        projectedRemainingStock: 14,
        shortfallQty: 0,
        recommendedOrderQty: 6,
        needsRestock: true,
      },
      {
        id: 'ing-3',
        ingredientCode: 'ING-CROISSANT',
        name: 'Phôi Bánh Croissant Đông',
        unit: 'chiếc',
        status: 'ACTIVE',
        storageType: 'FROZEN',
        currentStock: 80,
        minStockLevel: 30,
        predictedDemand: 44,
        projectedRemainingStock: 36,
        shortfallQty: 0,
        recommendedOrderQty: 0,
        needsRestock: false,
      },
    ];

    this.alerts = [
      {
        id: 'al-1',
        ingredientId: 'ing-1',
        ingredientCode: 'ING-CF-ROAST',
        ingredientName: 'Hạt Cà phê Arabica Rang',
        unit: 'kg',
        alertType: 'LOW_STOCK',
        severity: 'CRITICAL',
        status: 'OPEN',
        message: 'Tồn kho 8.5 kg thấp hơn mức an toàn (10 kg) và thiếu hụt cho dự báo 7 ngày tới.',
        generatedAt: this.todayIso(),
      },
    ];

    this.trend = [
      { date: '2026-10-28', label: '28/10', qty: 320, revenueVnd: 13800000, orderLines: 142 },
      { date: '2026-10-29', label: '29/10', qty: 345, revenueVnd: 14900000, orderLines: 158 },
      { date: '2026-10-30', label: '30/10', qty: 310, revenueVnd: 13400000, orderLines: 139 },
      { date: '2026-10-31', label: '31/10', qty: 390, revenueVnd: 16800000, orderLines: 175 },
      { date: '2026-11-01', label: '01/11', qty: 460, revenueVnd: 19900000, orderLines: 204 },
      { date: '2026-11-02', label: '02/11', qty: 485, revenueVnd: 21100000, orderLines: 218 },
      { date: '2026-11-03', label: '03/11', qty: 510, revenueVnd: 22300000, orderLines: 230 },
    ];

    this.recommendSummary = {
      totalBookingsAnalyzed: 412,
      multiItemBookings: 268,
      multiItemRate: 65.0,
      totalPairsFound: 24,
      avgBasketItems: 2.6,
      mlGlobalCount: 6,
      mlClusterCount: 3,
    };

    this.coOccurringPairs = [
      {
        rank: 1,
        itemA: { id: 'a1', code: 'DRK-CF-01', name: 'Cà phê Sữa Đá KÉN', category: 'INCLUSION' },
        itemB: { id: 'b1', code: 'CAK-01', name: 'Bánh Croissant Bơ Pháp', category: 'ADDON' },
        pairCount: 86,
        supportPct: 20.9,
        confidencePct: 54.4,
        lift: 1.82,
      },
      {
        rank: 2,
        itemA: { id: 'a2', code: 'DRK-MAT-03', name: 'Matcha Latte Yến Mạch', category: 'INCLUSION' },
        itemB: { id: 'b2', code: 'CAK-02', name: 'Tiramisu Cacao Mềm', category: 'ADDON' },
        pairCount: 61,
        supportPct: 14.8,
        confidencePct: 48.1,
        lift: 1.64,
      },
      {
        rank: 3,
        itemA: { id: 'a3', code: 'DRK-TEA-02', name: 'Trà Đào Cam Sả', category: 'INCLUSION' },
        itemB: { id: 'b3', code: 'EQP-MIC-01', name: 'Gói Micro + Bảng Flipchart', category: 'ADDON' },
        pairCount: 38,
        supportPct: 9.2,
        confidencePct: 33.9,
        lift: 1.35,
      },
    ];

    this.topTrending = [
      { id: 't1', code: 'DRK-CF-01', name: 'Cà phê Sữa Đá KÉN', category: 'DRINK', qty: 412, revenueVnd: 16068000 },
      { id: 't2', code: 'DRK-TEA-02', name: 'Trà Đào Cam Sả', category: 'DRINK', qty: 338, revenueVnd: 15210000 },
      { id: 't3', code: 'CAK-01', name: 'Bánh Croissant Bơ Pháp', category: 'CAKE', qty: 215, revenueVnd: 8170000 },
    ];

    this.clusters = [
      {
        clusterId: 'CLUSTER_STUDY',
        name: 'Sinh viên & Tự học tập trung',
        size: 185,
        items: [
          { name: 'Cà phê Sữa Đá KÉN', code: 'DRK-CF-01', score: 0.92 },
          { name: 'Bánh Croissant Bơ Pháp', code: 'CAK-01', score: 0.78 },
        ],
      },
      {
        clusterId: 'CLUSTER_MEET',
        name: 'Nhóm họp & Workshop dự án',
        size: 124,
        items: [
          { name: 'Trà Đào Cam Sả', code: 'DRK-TEA-02', score: 0.88 },
          { name: 'Gói Micro + Bảng Flipchart', code: 'EQP-MIC-01', score: 0.74 },
        ],
      },
    ];
  }

  get availableCategories(): string[] {
    const cats = new Set(this.dishes.map((d) => d.category).filter(Boolean));
    return ['Tất cả', ...Array.from(cats)];
  }

  get filteredDishes(): DishForecastRow[] {
    const q = this.search.trim().toLowerCase();
    const list = this.dishes.filter((item) => {
      if (this.category !== 'Tất cả' && item.category !== this.category) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.itemCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (this.sort === 'qty_desc') {
      return [...list].sort((a, b) => b.predictedQty - a.predictedQty);
    }
    if (this.sort === 'qty_asc') {
      return [...list].sort((a, b) => a.predictedQty - b.predictedQty);
    }
    if (this.sort === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }
    return list;
  }

  get filteredIngredients(): IngredientForecastRow[] {
    const q = this.search.trim().toLowerCase();
    return this.ingredients.filter((ing) => {
      if (this.ingredientFilter === 'RESTOCK' && !ing.needsRestock) return false;
      if (
        q &&
        !ing.name.toLowerCase().includes(q) &&
        !ing.ingredientCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }

  get totalPredictedDishes(): number {
    return this.dishes.reduce((sum, d) => sum + d.predictedQty, 0);
  }

  get drinkPredictedQty(): number {
    return this.dishes
      .filter((d) => d.category.includes('DRINK') || d.category.includes('BEV'))
      .reduce((sum, d) => sum + d.predictedQty, 0);
  }

  get foodPredictedQty(): number {
    return Math.max(0, this.totalPredictedDishes - this.drinkPredictedQty);
  }

  get topDish(): DishForecastRow | null {
    if (!this.dishes.length) return null;
    return [...this.dishes].sort((a, b) => b.predictedQty - a.predictedQty)[0];
  }

  get restockNeededCount(): number {
    return this.ingredients.filter((i) => i.needsRestock).length;
  }

  get openAlertsCount(): number {
    return this.alerts.filter((a) => a.status === 'OPEN').length;
  }

  get filteredDishSum(): number {
    return this.filteredDishes.reduce((s, d) => s + d.predictedQty, 0);
  }

  get filteredDishLowerSum(): number {
    return this.filteredDishes.reduce((s, d) => s + d.lowerQty, 0);
  }

  get filteredDishUpperSum(): number {
    return this.filteredDishes.reduce((s, d) => s + d.upperQty, 0);
  }

  get trendMaxQty(): number {
    const maxVal = Math.max(...this.trend.map((t) => t.qty), 10);
    return Math.ceil(maxVal / 50) * 50;
  }

  get trendAxisTicks(): number[] {
    const top = this.trendMaxQty;
    return [top, Math.round(top * 0.66), Math.round(top * 0.33), 0];
  }

  get maxPairCount(): number {
    return Math.max(...this.coOccurringPairs.map((p) => p.pairCount), 1);
  }

  barHeight(value: number): number {
    return Math.max(4, Math.min(100, Math.round((value / this.trendMaxQty) * 100)));
  }

  pairBarWidth(pairCount: number): number {
    return Math.max(8, Math.min(100, Math.round((pairCount / this.maxPairCount) * 100)));
  }

  categoryLabel(cat: string): string {
    const up = String(cat || '').toUpperCase();
    if (up === 'DRINK' || up === 'BEVERAGE') return 'Đồ uống';
    if (up === 'CAKE' || up === 'PASTRY') return 'Bánh ngọt';
    if (up === 'SNACK' || up === 'FOOD') return 'Đồ ăn nhẹ';
    if (up === 'EQUIPMENT' || up === 'ADDON') return 'Phụ kiện / Add-on';
    if (up === 'INCLUSION') return 'Combo đi kèm';
    return cat || 'Khác';
  }

  storageLabel(storage: string): string {
    const up = String(storage || '').toUpperCase();
    if (up === 'FROZEN') return 'Đông lạnh';
    if (up === 'CHILLED') return 'Làm mát';
    return 'Khô / Thường';
  }

  onSearchInput(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
    this.page['dish'] = 1;
    this.page['ing'] = 1;
  }

  onCategoryChange(event: Event): void {
    this.category = (event.target as HTMLSelectElement).value;
    this.page['dish'] = 1;
  }

  onSortChange(event: Event): void {
    this.sort = (event.target as HTMLSelectElement).value;
    this.page['dish'] = 1;
  }

  setIngredientFilter(f: 'ALL' | 'RESTOCK'): void {
    this.ingredientFilter = f;
    this.page['ing'] = 1;
  }

  readonly pageSize = 10;
  page: Record<string, number> = { dish: 1, ing: 1, pair: 1, alert: 1, trend: 1 };
  selectedDish: DishForecastRow | null = null;

  totalPages(len: number): number {
    return Math.max(1, Math.ceil(len / this.pageSize));
  }

  curPage(key: string, len: number): number {
    return Math.min(Math.max(1, this.page[key] || 1), this.totalPages(len));
  }

  paged<T>(key: string, list: T[]): T[] {
    const p = this.curPage(key, list.length);
    return list.slice((p - 1) * this.pageSize, p * this.pageSize);
  }

  pageFrom(key: string, len: number): number {
    return len === 0 ? 0 : (this.curPage(key, len) - 1) * this.pageSize + 1;
  }

  pageTo(key: string, len: number): number {
    return Math.min(len, this.curPage(key, len) * this.pageSize);
  }

  pageNumbers(key: string, len: number): number[] {
    const total = this.totalPages(len);
    const cur = this.curPage(key, len);
    const start = Math.max(1, Math.min(cur - 2, total - 4));
    const end = Math.min(total, start + 4);
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }

  goPage(key: string, p: number, len: number): void {
    this.page[key] = Math.min(Math.max(1, p), this.totalPages(len));
  }

  selectDish(d: DishForecastRow): void {
    this.selectedDish = this.selectedDish === d ? null : d;
    if (this.selectedDish) this.scrollToId('dish-detail');
  }

  private scrollToId(id: string): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  openMovementForm(ing: IngredientForecastRow): void {
    this.scrollToId('movement-drawer');
    this.activeMovementIngredient = ing;
    this.movementType = 'IN';
    this.movementQty = Math.max(1, Math.ceil(ing.recommendedOrderQty || 10));
    this.movementReason = ing.needsRestock ? 'Nhập bổ sung theo dự báo nhu cầu' : '';
  }

  closeMovementForm(): void {
    this.activeMovementIngredient = null;
  }

  onMovementTypeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as MovementType;
    this.movementType = ['IN', 'OUT', 'ADJUST', 'DISCARD'].includes(val) ? val : 'IN';
  }

  onMovementQtyInput(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.movementQty = Number.isFinite(n) ? n : 0;
  }

  onMovementReasonInput(event: Event): void {
    this.movementReason = (event.target as HTMLInputElement).value;
  }

  submitStockMovement(): void {
    const target = this.activeMovementIngredient;
    if (!target) return;

    let delta = Number(this.movementQty);
    if (!Number.isFinite(delta) || delta === 0) {
      this.notify('Số lượng biến động kho phải khác 0.', 'err');
      return;
    }
    if ((this.movementType === 'OUT' || this.movementType === 'DISCARD') && delta > 0) {
      delta = -Math.abs(delta);
    }
    if (this.movementType === 'IN' && delta < 0) {
      delta = Math.abs(delta);
    }

    const payload = {
      movementType: this.movementType,
      quantityChange: delta,
      reason: this.movementReason.trim() || `Cập nhật ${this.movementType} từ Admin`,
    };

    if (!this.http || this.usingFallback) {
      const nextStock = Math.max(0, Number((target.currentStock + delta).toFixed(2)));
      this.ingredients = this.ingredients.map((i) =>
        i.id === target.id
          ? {
              ...i,
              currentStock: nextStock,
              projectedRemainingStock: Number((nextStock - i.predictedDemand).toFixed(2)),
              shortfallQty: Math.max(0, Number((i.predictedDemand - nextStock).toFixed(2))),
              recommendedOrderQty: Math.max(
                0,
                Number((i.predictedDemand + i.minStockLevel - nextStock).toFixed(2)),
              ),
              needsRestock:
                nextStock < i.minStockLevel || nextStock - i.predictedDemand < i.minStockLevel,
            }
          : i,
      );
      this.activeMovementIngredient = null;
      this.notify(`Đã ghi nhận ${this.movementType} (${delta} ${target.unit}) cho ${target.name}`);
      return;
    }

    this.savingMovement = true;
    this.http.post<any>(`/api/admin/forecast/ingredients/${target.id}/movements`, payload).subscribe({
      next: () => {
        this.savingMovement = false;
        this.activeMovementIngredient = null;
        this.notify(`Đã cập nhật tồn kho ${target.name}`);
        this.loadForecastBundle();
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.savingMovement = false;
        this.notify(err?.error?.message || 'Không thể cập nhật giao dịch kho.', 'err');
        this.cdr?.markForCheck();
      },
    });
  }

  updateAlertStatus(alert: InventoryAlertRow, nextStatus: 'ACKNOWLEDGED' | 'RESOLVED'): void {
    if (!this.http || this.usingFallback) {
      this.alerts = this.alerts.filter((a) => a.id !== alert.id);
      this.notify(`Đã đánh dấu cảnh báo ${alert.ingredientCode}: ${nextStatus}`);
      return;
    }

    this.http
      .patch<any>(`/api/admin/forecast/alerts/${alert.id}`, { status: nextStatus })
      .subscribe({
        next: () => {
          this.alerts = this.alerts.filter((a) => a.id !== alert.id);
          this.notify(`Đã xử lý cảnh báo ${alert.ingredientName} (${nextStatus})`);
          this.cdr?.markForCheck();
        },
        error: (err) => {
          this.notify(err?.error?.message || 'Không thể cập nhật cảnh báo.', 'err');
        },
      });
  }

  exportCsv(): void {
    let header: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = '';

    if (this.activeTab === 'FORECAST') {
      header = ['ItemCode', 'DishName', 'Category', 'PredictedQty', 'LowerQty', 'UpperQty', 'Model'];
      rows = this.filteredDishes.map((d) => [
        d.itemCode,
        d.name,
        d.category,
        d.predictedQty,
        d.lowerQty,
        d.upperQty,
        d.modelVersion,
      ]);
      filename = `ken-forecast-${this.fromDate}-to-${this.toDate}.csv`;
    } else {
      header = ['Rank', 'ItemA', 'ItemB', 'PairCount', 'SupportPct', 'ConfidencePct', 'Lift'];
      rows = this.coOccurringPairs.map((p) => [
        p.rank,
        p.itemA.name,
        p.itemB.name,
        p.pairCount,
        p.supportPct,
        p.confidencePct,
        p.lift,
      ]);
      filename = `ken-recommend-pairs-${this.todayIso()}.csv`;
    }

    const csv = [header, ...rows]
      .map((line) => line.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    if (typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    this.notify(`Đã xuất ${rows.length} dòng báo cáo ra CSV`);
  }

  formatCurrency(val: number): string {
    return `${Math.round(val || 0).toLocaleString('vi-VN')}đ`;
  }

  shortDate(iso: string): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '—';
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}`;
  }

  formatDateVi(iso: string): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private plusDaysIso(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  }

  private notify(msg: string, type: 'ok' | 'err' = 'ok'): void {
    this.toast = msg;
    this.toastType = type;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = '';
      this.cdr?.markForCheck();
    }, 3200);
  }
}
