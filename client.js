window.__ModuleLoader__.load({
  id: "dsh-web-access",
  factory(require) {
    // The browser loads this file as an ES module, where `exports` and
    // `module` do not exist; the plugin face is built inside the factory.
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const h = React.createElement;
    const { useEffect, useState } = React;
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const {
      Button,
      SettingsForm,
      SettingsFormModel,
      SettingsValueField,
      settingsNumberField,
      settingsTextField
    } = primitives;

    /** Dictionary namespace owned by this plugin. */
    const NS = "settings.webAccess";
    /** Host profile entry whose volatile fields this page edits. */
    const ENTRY_ID = "web-access";
    /** This bundle's package name: the key its configuration registers under. */
    const BUNDLE_NAME = "dsh-web-access";
    /** Route carrying the non-secret view of the current state. */
    const STATE_PATH = "/web-access/state";
    /** Route serving the QR code of the effective phone URL. */
    const QR_PATH = "/web-access/qr.svg";

    /** English copy. */
    const en = {
      title: "Web access",
      description: "Pin the Web GUI launch token, extend the session cookie, and reach the GUI from a phone.",
      publicUrl: "Phone address",
      publicUrlHint: "The address the phone opens, for example https://dsh.example.com/. Leave empty to advertise the bound address. The token exchange only happens at the site root, so no path prefix.",
      cookieDays: "Session lifetime (days)",
      cookieDaysHint: "How long a signed session cookie stays valid. 0 keeps the shipped 30 days.",
      launchToken: "Fixed launch token",
      launchTokenHint: "The value never travels back to the browser, so this box stays empty. Type a value to replace the pinned token; the clear button beside it returns to the random per-boot token.",
      clearToken: "Clear token",
      clearTokenHint: "Remove the pinned token and go back to the random per-boot token",
      tokenPlaceholderSet: "A fixed token is set — type a value to replace it",
      tokenPlaceholder: "Not set — the random per-boot token is in use",
      overridden: "Overridden",
      reset: "Reset to default",
      resetToken: "Back to the random token",
      invalidText: "This value cannot be saved.",
      invalidNumber: "Enter a number, or leave blank to use the default.",
      save: "Save",
      saving: "Saving…",
      saveFailed: "The deployment did not accept these values; they were left for you to correct.",
      unavailable: "This plugin is not loaded, so it cannot be configured right now.",
      readOnly: "This deployment stores settings read-only.",
      qrLoading: "Loading the phone URL…",
      qrAlt: "QR code of the phone URL",
      qrHint: "Scan it with the phone, then bookmark the address: the same URL keeps working after a restart."
    };
    /** Simplified Chinese copy. */
    const zh = {
      title: "Web 访问",
      description: "固定 Web GUI 的启动令牌、延长会话 Cookie，并在手机上访问这台机器。",
      publicUrl: "手机访问地址",
      publicUrlHint: "手机上打开的地址，例如 https://dsh.example.com/。留空则使用本机绑定地址。令牌交换只发生在站点根路径，因此不能带路径前缀。",
      cookieDays: "会话有效期（天）",
      cookieDaysHint: "签名会话 Cookie 的有效天数。填 0 表示沿用默认的 30 天。",
      launchToken: "固定启动令牌",
      launchTokenHint: "令牌不会回传到浏览器，所以这个输入框始终是空的：输入新值即可替换已固定的令牌；旁边的「清除固定令牌」按钮可把它恢复成每次启动随机的令牌。",
      clearToken: "清除固定令牌",
      clearTokenHint: "删除已固定的令牌，恢复为每次启动随机的令牌",
      tokenPlaceholderSet: "已设置固定令牌 —— 输入新值即可替换",
      tokenPlaceholder: "未设置 —— 当前使用每次启动随机的令牌",
      overridden: "已覆盖",
      reset: "恢复默认",
      resetToken: "恢复为随机令牌",
      invalidText: "这个值无法保存。",
      invalidNumber: "请填数字；留空表示使用默认值。",
      save: "保存",
      saving: "保存中…",
      saveFailed: "本部署没有接受这些值，已保留供你修改。",
      unavailable: "该插件当前未加载，暂时无法配置。",
      readOnly: "本部署的设置为只读。",
      qrLoading: "正在读取手机地址…",
      qrAlt: "手机网址的二维码",
      qrHint: "用手机扫一扫，然后收藏这个地址：重启后同一个网址依然有效。"
    };

    /**
     * The phone URL with its QR code, read from the Host so the code shows the
     * token actually in force.
     * @param props - component props carrying the translator and a revision.
     * @returns the QR block.
     */
    function QrBlock(props) {
      const { t, revision } = props;
      const [state, setState] = useState(null);
      useEffect(() => {
        let alive = true;
        fetch(STATE_PATH, { credentials: "same-origin" })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (alive) setState(data);
          })
          .catch(() => {
            if (alive) setState(null);
          });
        return () => {
          alive = false;
        };
      }, [revision]);
      if (state === null) {
        return h("p", { style: { margin: "8px 0 0", fontSize: 13, opacity: 0.7 } }, t("qrLoading"));
      }
      const address = state.publicUrl || state.advertisedUrl;
      return h("div", { style: { marginTop: 16, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" } }, [
        h("img", {
          src: `${QR_PATH}?v=${encodeURIComponent(String(revision))}`,
          width: 200,
          height: 200,
          alt: t("qrAlt")
        }),
        h("div", { style: { fontSize: 13, lineHeight: 1.7 } }, [
          h("div", { style: { opacity: 0.7, marginBottom: 4 } }, t("qrHint")),
          h("code", { style: { wordBreak: "break-all" } }, address)
        ])
      ]);
    }

    /**
     * The page's card: the three deployment-owned values and the phone QR.
     * @param props - slot props carrying the page state and the form actions.
     * @returns the card.
     */
    function WebAccessCard(props) {
      const { t } = props;
      const state = props.useWebAccessCard((snapshot) => snapshot);
      if (props.view === "summary") return t("description");
      return h(SettingsForm, {
        labels: {
          unavailable: t("unavailable"),
          readOnly: t("readOnly"),
          saveFailed: t("saveFailed"),
          save: t("save"),
          saving: t("saving")
        },
        state,
        onSave: props.save,
        onDiscard: props.discard,
        children: [
          h(SettingsValueField, {
            id: "web-access-public-url",
            label: t("publicUrl"),
            hint: t("publicUrlHint"),
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalidNumber"),
            disabled: !state.writable,
            ...state.publicUrl,
            onEdit: (text) => props.edit("publicUrl", text),
            onReset: () => props.resetField("publicUrl")
          }),
          h(SettingsValueField, {
            id: "web-access-cookie-days",
            label: t("cookieDays"),
            hint: t("cookieDaysHint"),
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalidNumber"),
            numeric: true,
            disabled: !state.writable,
            ...state.cookieMaxAgeDays,
            onEdit: (text) => props.edit("cookieMaxAgeDays", text),
            onReset: () => props.resetField("cookieMaxAgeDays")
          }),
          h("div", { style: { display: "flex", gap: 8, alignItems: "flex-start" } }, [
            h("div", { style: { flex: "1 1 auto", minWidth: 0 } },
              h(SettingsValueField, {
                id: "web-access-launch-token",
                label: t("launchToken"),
                hint: t("launchTokenHint"),
                placeholder: state.tokenConfigured ? t("tokenPlaceholderSet") : t("tokenPlaceholder"),
                overriddenLabel: t("overridden"),
                resetLabel: t("resetToken"),
                invalidLabel: t("invalidText"),
                disabled: !state.writable,
                ...state.launchToken,
                onEdit: (text) => props.edit("launchToken", text),
                onReset: () => props.resetField("launchToken")
              })
            ),
            h(Button, {
              variant: "outline",
              disabled: !state.writable || !state.tokenConfigured,
              onClick: () => props.clearToken(),
              title: t("clearTokenHint")
            }, t("clearToken"))
          ]),
          h(QrBlock, { t, revision: state.revision })
        ]
      });
    }

    /**
     * The page's staged form over the `web-access` entry.
     */
    var WebAccessCardController = class {
      /**
       * @param scope - the form controller bound to the Host entry.
       * @param mirror - the shared describe mirror carrying the secret markers.
       */
      constructor(scope, mirror) {
        this.scope = scope;
        this.mirror = mirror;
        this.form = new SettingsFormModel(
          scope,
          [
            settingsTextField("publicUrl"),
            settingsNumberField("cookieMaxAgeDays"),
            // The Host redacts this field, so the value never reaches the
            // browser: the input stays empty and the placeholder says whether
            // a token is pinned. Editing writes a new one; the field's own
            // reset control unsets it, which is the only way back to the
            // per-boot random token.
            settingsTextField("launchToken")
          ]
        );
        this.store = this.form.bind(() => this.projection());
      }
      /** Whether the deployment pins a launch token of its own. */
      tokenConfigured() {
        const view = this.mirror.getSnapshot().view;
        const namespaces = view?.namespaces ?? [];
        const entry = namespaces.find((candidate) => candidate.ns === ENTRY_ID);
        const secret = (entry?.secrets ?? []).find(
          (candidate) => candidate.path.length === 1 && candidate.path[0] === "launchToken"
        );
        return secret?.set === true;
      }
      /** The page's snapshot: the form shell, its fields, and the secret marker. */
      projection() {
        return {
          ...this.form.shell(),
          revision: this.scope.getSnapshot().revision,
          publicUrl: this.form.field("publicUrl"),
          cookieMaxAgeDays: this.form.field("cookieMaxAgeDays"),
          launchToken: this.form.field("launchToken"),
          tokenConfigured: this.tokenConfigured()
        };
      }
      /** The face the slot registration injects. */
      inject() {
        return {
          hooks: { webAccessCard: this.store },
          ...this.form.actions(),
          clearToken: () => this.clearToken()
        };
      }
      /**
       * Unset the pinned token, which returns the deployment to the per-boot
       * random one. The shared form cannot express this: a redacted field
       * carries no value, so an empty input stages nothing to write.
       * @returns whether the Host accepted the change.
       */
      async clearToken() {
        const accepted = await this.scope.unset("launchToken");
        this.form.staged?.delete?.("launchToken");
        this.form.publish?.();
        return accepted;
      }
      /** Release accepted-value subscriptions. */
      dispose() {
        this.form.dispose();
      }
    };

    /**
     * Mount the Web access settings page while the Host serves its entry.
     *
     * The page lives on the bundle's own page in the Plugins section: a
     * bundle's configuration belongs to `plugins.bundle.config`, keyed by the
     * bundle's package name, and that page renders it between the bundle
     * description and its rows.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { en, zh, ja: en, es: en, fr: en, de: en, ru: en, pt: en }),
        "web-access: dictionaries"
      );
      const card = new WebAccessCardController(ctx.configForms.get(ENTRY_ID), ctx.configForms.describe());
      ctx.effect(() => () => card.dispose(), "web-access: form subscription");
      ctx.effect(
        () => ctx.configForms.whileServed([ENTRY_ID], () =>
          ctx.slots.inject("plugins.bundle.config", () =>
            ctx.slots.register(
              {
                name: "plugins.bundle.config",
                key: BUNDLE_NAME,
                locale: NS,
                inject: () => card.inject()
              },
              WebAccessCard
            )
          )
        ),
        "web-access: page"
      );
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = ["slots", "locale", "configForms"];
    return module.exports;
  }
});
