<?php

namespace App\Http\Controllers;

use App\Services\ApiGateway;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    private ApiGateway $api;

    public function __construct(ApiGateway $api)
    {
        $this->api = $api;
    }

    public function showLogin()
    {
        if (session('auth_token')) {
            return redirect('/');
        }
        // Store the previous page URL so we can redirect back after login
        $intended = session('redirect') ?? url()->previous();
        if (str_contains($intended, '/login') || str_contains($intended, '/register')) {
            $intended = '/';
        }
        session(['url.intended' => $intended]);
        return view('pages.login', ['title' => 'Login - ZylkerKart', 'intended' => $intended]);
    }

    public function showRegister()
    {
        if (session('auth_token')) {
            return redirect('/');
        }
        return view('pages.register', ['title' => 'Register - ZylkerKart']);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|min:6',
        ]);

        $result = $this->api->post('auth', '/auth/login', [
            'email'    => $request->email,
            'password' => $request->password,
        ]);

        if ($result['status'] === 200) {
            session([
                'auth_token'    => $result['data']['accessToken'],
                'refresh_token' => $result['data']['refreshToken'],
                'user'          => $result['data']['user'],
            ]);

            $redirect = $request->get('redirect', session('url.intended', '/'));
            session()->forget('url.intended');
            return redirect($redirect)->with('success', 'Welcome back!');
        }

        return back()->withErrors([
            'email' => $result['data']['error'] ?? 'Login failed',
        ]);
    }

    public function register(Request $request)
    {
        $request->validate([
            'full_name' => 'required|max:255',
            'email'     => 'required|email',
            'password'  => 'required|min:8|confirmed',
            'phone'     => 'nullable|max:20',
        ]);

        $result = $this->api->post('auth', '/auth/register', [
            'email'    => $request->email,
            'password' => $request->password,
            'fullName' => $request->full_name,
            'phone'    => $request->phone,
        ]);

        if ($result['status'] === 200) {
            session([
                'auth_token'    => $result['data']['accessToken'],
                'refresh_token' => $result['data']['refreshToken'],
                'user'          => $result['data']['user'],
            ]);

            return redirect('/')->with('success', 'Account created successfully!');
        }

        return back()->withErrors([
            'email' => $result['data']['error'] ?? 'Registration failed',
        ]);
    }

    public function logout()
    {
        $refreshToken = session('refresh_token');
        if ($refreshToken) {
            $this->api->post('auth', '/auth/logout', [
                'refreshToken' => $refreshToken,
            ]);
        }

        session()->forget(['auth_token', 'refresh_token', 'user']);
        return redirect('/')->with('success', 'Logged out successfully');
    }
}
