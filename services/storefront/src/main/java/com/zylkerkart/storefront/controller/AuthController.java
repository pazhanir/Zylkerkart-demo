package com.zylkerkart.storefront.controller;

import com.zylkerkart.storefront.service.ApiGateway;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Controller
public class AuthController {

    private final ApiGateway api;

    public AuthController(ApiGateway api) {
        this.api = api;
    }

    @GetMapping("/login")
    public String showLogin(Model model, HttpSession session,
                            @RequestParam(value = "redirect", required = false) String redirect,
                            @RequestHeader(value = "Referer", required = false) String referer) {
        if (session.getAttribute("auth_token") != null) {
            return "redirect:/";
        }
        // Store the page to return to after login
        if (redirect != null && !redirect.isEmpty()) {
            session.setAttribute("redirect", redirect);
        } else if (referer != null && !referer.isEmpty() && !referer.contains("/login") && !referer.contains("/register")) {
            // Extract path from referer URL (strip host)
            try {
                java.net.URI uri = new java.net.URI(referer);
                String path = uri.getPath();
                if (path != null && !path.isEmpty()) {
                    session.setAttribute("redirect", path);
                }
            } catch (Exception ignored) {
                // Skip invalid referer
            }
        }
        model.addAttribute("title", "Login - ZylkerKart");
        model.addAttribute("user", session.getAttribute("user"));
        model.addAttribute("sessionId", session.getId());
        model.addAttribute("authToken", session.getAttribute("auth_token"));
        return "pages/login";
    }

    @GetMapping("/register")
    public String showRegister(Model model, HttpSession session) {
        if (session.getAttribute("auth_token") != null) {
            return "redirect:/";
        }
        model.addAttribute("title", "Register - ZylkerKart");
        model.addAttribute("user", session.getAttribute("user"));
        model.addAttribute("sessionId", session.getId());
        model.addAttribute("authToken", session.getAttribute("auth_token"));
        return "pages/register";
    }

    @PostMapping("/login")
    public String login(
            @RequestParam String email,
            @RequestParam String password,
            HttpSession session,
            Model model) {

        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);

        Map<String, Object> result = api.post("auth", "/auth/login", body);
        int status = (int) result.get("status");

        if (status >= 200 && status < 300) {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            if (data != null) {
                session.setAttribute("auth_token", data.get("accessToken"));
                session.setAttribute("user", data.get("user"));
            }
            String redirect = (String) session.getAttribute("redirect");
            session.removeAttribute("redirect");
            return "redirect:" + (redirect != null ? redirect : "/");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> errorData = (Map<String, Object>) result.get("data");
        String error = errorData != null
                ? (String) errorData.getOrDefault("error", "Invalid email or password")
                : "Invalid email or password";

        model.addAttribute("error", error);
        model.addAttribute("email", email);
        model.addAttribute("title", "Login - ZylkerKart");
        model.addAttribute("user", session.getAttribute("user"));
        model.addAttribute("sessionId", session.getId());
        model.addAttribute("authToken", session.getAttribute("auth_token"));
        return "pages/login";
    }

    @PostMapping("/register")
    public String register(
            @RequestParam String name,
            @RequestParam String email,
            @RequestParam String password,
            @RequestParam(name = "password_confirmation") String passwordConfirmation,
            HttpSession session,
            Model model) {

        if (!password.equals(passwordConfirmation)) {
            model.addAttribute("error", "Passwords do not match");
            model.addAttribute("name", name);
            model.addAttribute("email", email);
            model.addAttribute("title", "Register - ZylkerKart");
            model.addAttribute("user", session.getAttribute("user"));
            model.addAttribute("sessionId", session.getId());
            model.addAttribute("authToken", session.getAttribute("auth_token"));
            return "pages/register";
        }

        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("email", email);
        body.put("password", password);

        Map<String, Object> result = api.post("auth", "/auth/register", body);
        int status = (int) result.get("status");

        if (status >= 200 && status < 300) {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) result.get("data");
            if (data != null) {
                session.setAttribute("auth_token", data.get("accessToken"));
                session.setAttribute("user", data.get("user"));
            }
            return "redirect:/";
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> errorData = (Map<String, Object>) result.get("data");
        String error = errorData != null
                ? (String) errorData.getOrDefault("error", "Registration failed")
                : "Registration failed";

        model.addAttribute("error", error);
        model.addAttribute("name", name);
        model.addAttribute("email", email);
        model.addAttribute("title", "Register - ZylkerKart");
        model.addAttribute("user", session.getAttribute("user"));
        model.addAttribute("sessionId", session.getId());
        model.addAttribute("authToken", session.getAttribute("auth_token"));
        return "pages/register";
    }

    @PostMapping("/logout")
    public String logout(HttpSession session) {
        session.removeAttribute("auth_token");
        session.removeAttribute("user");
        return "redirect:/login";
    }
}
