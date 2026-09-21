import * as asset from "@canva/asset/test";
import * as design from "@canva/design/test";
import * as error from "@canva/error/test";

asset.initTestEnvironment();
design.initTestEnvironment();
// @canva/error는 mock하지 않는다. 테스트가 실제 CanvaError를 만들어 던질 수
// 있어야 오류 분류(rate_limited 등)를 진짜로 검증할 수 있다.
error.initTestEnvironment();
jest.mock("@canva/asset");
jest.mock("@canva/design");
