/**
 * SSR 렌더링 엔트리 포인트
 * - 서버에서 URL에 맞는 HTML을 생성
 * - 초기 데이터를 함께 반환하여 클라이언트 Hydration에 사용
 */
import { ServerRouter } from "./router/serverRouter.js";
import { mockGetProducts, mockGetProduct, mockGetCategories } from "./mocks/mockApi.js";
import { productStore, initialProductState } from "./stores/productStore.js";
import { PRODUCT_ACTIONS } from "./stores/actionTypes.js";
import { HomePage, ProductDetailPage, NotFoundPage } from "./pages/index.js";
import { BASE_URL } from "./constants.js";

/**
 * 서버 라우터 설정
 */
function createServerRouter() {
  const router = new ServerRouter(BASE_URL);
  router.addRoute("/", HomePage);
  router.addRoute("/product/:id/", ProductDetailPage);
  return router;
}

/**
 * 데이터 프리페칭
 * - 라우트에 따라 필요한 데이터를 미리 가져옴
 * @param {string} path - 매칭된 라우트 경로
 * @param {Object} params - URL 파라미터 (예: { id: "123" })
 * @returns {Object} initialData - 클라이언트에 전달할 초기 데이터
 */
async function prefetchData(path, params) {
  // 홈페이지
  if (path === "/") {
    const { products, pagination } = mockGetProducts();
    const categories = mockGetCategories();
    return {
      products,
      totalCount: pagination.total,
      categories,
      loading: false,
    };
  }

  // 상품 상세
  if (path === "/product/:id/") {
    const currentProduct = mockGetProduct(params.id);

    // 상품이 없으면 에러 반환
    if (!currentProduct) {
      return { error: "상품을 찾을 수 없습니다", loading: false };
    }

    // 관련 상품 (같은 카테고리, 현재 상품 제외)
    const { products } = mockGetProducts({ category1: currentProduct.category1 });
    const relatedProducts = products.filter((p) => p.productId !== params.id);

    return {
      currentProduct,
      relatedProducts,
      loading: false,
    };
  }

  return { loading: false };
}

/**
 * 스토어 초기화
 * - SSR에서는 매 요청마다 스토어를 초기 상태로 리셋해야 함
 * - 이전 요청의 데이터가 남아있으면 안 됨
 */
function resetStore() {
  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: initialProductState,
  });
}

/**
 * 메인 렌더링 함수
 * @param {string} url - 요청 URL
 * @returns {{ html: string, head: string, initialData: Object }}
 */
export async function render(url) {
  // 1. 스토어 초기화
  resetStore();

  // 2. 라우터 생성 및 URL 매칭
  const router = createServerRouter();
  const matchedRoute = router.match(url);

  // 3. 데이터 프리페칭
  const initialData = matchedRoute ? await prefetchData(matchedRoute.path, matchedRoute.params) : {};

  // 4. 스토어에 데이터 설정
  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: initialData,
  });

  // 5. 페이지 컴포넌트 호출하여 HTML 생성
  const PageComponent = matchedRoute?.handler || NotFoundPage;
  const html = PageComponent();

  // 6. head 태그 생성
  let title = "쇼핑몰";
  if (matchedRoute?.path === "/product/:id/" && initialData.currentProduct) {
    title = `${initialData.currentProduct.title} - 쇼핑몰`;
  }
  const head = `<title>${title}</title>`;

  // 7. 반환
  return { html, head, initialData };
}
