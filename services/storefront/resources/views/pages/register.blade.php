@extends('layouts.app')

@section('title', 'Register - ZylkerKart')

@section('content')
<div style="max-width: 420px; margin: 40px auto; padding: 0 16px;">
    <div style="background: #fff; border-radius: 8px; padding: 35px; border: 1px solid #eee;">
        <h2 style="text-align: center; margin-bottom: 5px;">Create Account</h2>
        <p style="text-align: center; color: #888; margin-bottom: 25px; font-size: 14px;">Join ZylkerKart today</p>

        @if(isset($error))
            <div style="background: #fce4ec; color: #c62828; padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; font-size: 14px;">
                {{ $error }}
            </div>
        @endif

        <form method="POST" action="/register">
            @csrf
            <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500;">Full Name</label>
                <input type="text" name="full_name" required placeholder="Enter your full name"
                       value="{{ old('full_name', '') }}"
                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500;">Email Address</label>
                <input type="email" name="email" required placeholder="you@example.com"
                       value="{{ old('email', '') }}"
                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500;">Phone Number</label>
                <input type="tel" name="phone" placeholder="10-digit mobile number"
                       value="{{ old('phone', '') }}"
                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500;">Password</label>
                <input type="password" name="password" required placeholder="Min 8 characters" minlength="8"
                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500;">Confirm Password</label>
                <input type="password" name="password_confirmation" required placeholder="Re-enter your password"
                       style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; padding: 13px; font-size: 15px; margin-top: 5px;">
                Create Account
            </button>
        </form>

        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <span style="color: #888; font-size: 14px;">Already have an account?</span>
            <a href="/login" style="color: #2196f3; font-size: 14px; font-weight: 500; margin-left: 5px;">Login</a>
        </div>
    </div>
</div>
@endsection
