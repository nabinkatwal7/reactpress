import type { ThemeModule } from "@/lib/theme/types";
import Footer from "./parts/footer";
import Header from "./parts/header";
import Archive from "./templates/archive";
import Home from "./templates/home";
import Index from "./templates/index";
import NotFound from "./templates/404";
import Page from "./templates/page";
import Search from "./templates/search";
import Single from "./templates/single";

const theme: ThemeModule = {
  templates: {
    index: Index,
    home: Home,
    single: Single,
    page: Page,
    archive: Archive,
    search: Search,
    "404": NotFound,
  },
  parts: { header: Header, footer: Footer },
};

export default theme;
