// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// A short launch splash: a night sky, the logo and name, and the opening
// line of one of the corpus's books, then a fade to the real UI. Loads
// Resources/AppIcon-1024.png from this package's own bundle rather than
// either app target's Assets.xcassets, so one image serves both shells.

import SwiftUI

#if canImport(UIKit)
    import UIKit
#elseif canImport(AppKit)
    import AppKit
#endif

/// The bundled 1024pt app icon, loaded once. `nil` only if the resource copy
/// in Package.swift and this name ever drift apart. Shared with AboutView.swift
/// rather than loaded twice. `.copy("Resources")` keeps the folder, so in an
/// app's built bundle the icon sits in a `Resources` subdirectory, as the
/// lockup does for ConversationPDF.swift.
let appIconImage: Image? = {
    guard let url = Bundle.module.url(forResource: "AppIcon-1024", withExtension: "png")
        ?? Bundle.module.url(forResource: "AppIcon-1024", withExtension: "png", subdirectory: "Resources")
    else {
        return nil
    }
    #if canImport(UIKit)
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        return Image(uiImage: image)
    #elseif canImport(AppKit)
        guard let image = NSImage(contentsOf: url) else { return nil }
        return Image(nsImage: image)
    #else
        return nil
    #endif
}()

/// The splash's night. The iOS launch screen is the same color
/// (Assets.xcassets/LaunchBackground), so the system's launch screen and this
/// splash meet without a flash.
let splashNight = Color(red: 11 / 255, green: 16 / 255, blue: 33 / 255)

/// Wraps `content` with a splash overlay that fades out after a short hold,
/// or at once on a tap.
///
/// The hold is fixed rather than tied to `AppModel.loadCorpusPacks()` —
/// corpus load time varies with storage speed and this is meant to read as
/// a brand moment, not a progress indicator. A slow first launch still shows
/// "connecting…" in Settings once the splash clears, same as it always has.
///
/// The overlay is opaque from the first frame. Fading it in would show the
/// app's own (light) window beneath it for a moment: the flash between the
/// dark launch screen and the splash.
public struct SplashOverlay<Content: View>: View {
    @State private var showSplash = true
    @State private var opening = FirstLine.all.randomElement()!
    @State private var splashOpacity: Double = 1
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        ZStack {
            content
            if showSplash {
                SplashView(opening: opening)
                    .opacity(splashOpacity)
                    .onTapGesture { dismiss() }
                    .task {
                        try? await Task.sleep(for: .seconds(opening.hold))
                        dismiss()
                    }
            }
        }
    }

    private func dismiss() {
        guard showSplash, splashOpacity == 1 else { return }
        withAnimation(.easeOut(duration: 0.8)) { splashOpacity = 0 }
        Task {
            try? await Task.sleep(for: .seconds(0.8))
            showSplash = false
        }
    }
}

private struct SplashView: View {
    @State private var logoOpacity: Double = 0
    @State private var lineOpacity: Double = 0
    let opening: FirstLine

    var body: some View {
        ZStack {
            splashNight.ignoresSafeArea()
            NightSky()
                .opacity(logoOpacity)
                .ignoresSafeArea()
            VStack(spacing: 28) {
                VStack(spacing: 16) {
                    if let appIconImage {
                        appIconImage
                            .resizable()
                            .scaledToFit()
                            .frame(width: 120, height: 120)
                            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                            .shadow(color: .black.opacity(0.6), radius: 12)
                    }
                    VStack(spacing: 4) {
                        Text("The Knowledge Press")
                            .font(.title2.bold())
                        Text("The Forest")
                            .font(.title3.italic())
                            .foregroundStyle(.tint)
                    }
                }
                .opacity(logoOpacity)
                VStack(spacing: 8) {
                    Text(opening.line)
                        .font(.system(.title3, design: .serif).italic())
                        .multilineTextAlignment(.center)
                    Text("\(opening.author), \(Text(opening.title).italic())")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: 440)
                .padding(.horizontal, 32)
                .opacity(lineOpacity)
            }
        }
        .foregroundStyle(.white)
        .environment(\.colorScheme, .dark)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            withAnimation(.easeIn(duration: 0.8)) { logoOpacity = 1 }
            withAnimation(.easeIn(duration: 1.2).delay(1.0)) { lineOpacity = 1 }
        }
    }
}

/// Stars over a sky that lightens toward the horizon. They twinkle unless
/// Reduce Motion is on. Placed by a fixed seed, so the sky is the same at
/// every launch.
private struct NightSky: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Star {
        let x, y, size, brightness, speed, phase: Double
    }

    private static let stars: [Star] = {
        var seed: UInt64 = 0x5EED_F0E5
        func next() -> Double {
            seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            return Double(seed >> 11) / Double(1 << 53)
        }
        return (0..<160).map { _ in
            Star(x: next(), y: pow(next(), 1.4), size: 0.6 + 1.6 * pow(next(), 3),
                 brightness: 0.35 + 0.65 * next(), speed: 0.6 + 1.8 * next(), phase: 2 * .pi * next())
        }
    }()

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                context.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .linearGradient(
                        Gradient(colors: [splashNight, Color(red: 27 / 255, green: 38 / 255, blue: 72 / 255)]),
                        startPoint: CGPoint(x: size.width / 2, y: size.height * 0.35),
                        endPoint: CGPoint(x: size.width / 2, y: size.height)))
                for star in Self.stars {
                    let twinkle = reduceMotion ? 1 : 0.65 + 0.35 * sin(t * star.speed + star.phase)
                    let rect = CGRect(x: star.x * size.width, y: star.y * size.height * 0.9,
                                      width: star.size, height: star.size)
                    context.opacity = star.brightness * twinkle
                    context.fill(Path(ellipseIn: rect), with: .color(.white))
                }
            }
        }
    }
}
