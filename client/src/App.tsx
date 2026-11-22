import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/app-layout"
import Home from "@/pages/home"
import { ComingSoon, NotFound } from "@/pages/simple-pages"
import { PLACEHOLDER_ROUTES } from "@/lib/nav"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          {PLACEHOLDER_ROUTES.map((r) => (
            <Route key={r.to} path={r.to} element={<ComingSoon />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
