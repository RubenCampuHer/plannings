import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacitat · Plannings",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Política de privacitat
      </h1>
      <p className="text-ink-soft text-sm mt-1">
        Última actualització: 21 de maig de 2026
      </p>

      <div className="mt-8 space-y-6 text-ink text-[15px] leading-relaxed">
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Qui som
          </h2>
          <p>
            Plannings és un projecte personal en beta privada gestionat per Rubén
            Campuzano (Barcelona, Espanya). Pots contactar-nos a{" "}
            <a href="mailto:ruben@aima.chat" className="text-peach-deep underline">
              ruben@aima.chat
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Quines dades guardem
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Identificació</strong>: el teu correu electrònic i (si fas
              servir Google) el nom i l'avatar associats al compte.
            </li>
            <li>
              <strong>Contingut</strong>: els plans que crees — text, llocs,
              checklists, fotos i documents que pugis.
            </li>
            <li>
              <strong>Tècnic</strong>: cookies de sessió per mantenir-te connectat
              i una preferència d'onboarding. No fem cap perfilat ni publicitat.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Per a què les fem servir
          </h2>
          <p>
            Únicament per fer funcionar el servei: mostrar-te els teus plans,
            permetre que els comparteixis amb persones convidades i, opcionalment,
            enriquir-los amb IA (text i imatges) si tu ho demanes.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Amb qui les compartim
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Supabase</strong> (allotjament de base de dades i fitxers,
              EU).
            </li>
            <li>
              <strong>Vercel</strong> (hosting de l'aplicació, EU/US).
            </li>
            <li>
              <strong>Google AI Studio (Gemini)</strong> quan tu fas servir
              funcions de polish o anàlisi de Word. Només s'envia el contingut
              del pla que estàs treballant en aquell moment.
            </li>
            <li>
              <strong>Pexels</strong> per buscar imatges públiques quan demanes
              il·lustracions.
            </li>
          </ul>
          <p>
            No venem dades, no fem publicitat, no compartim res amb cap altre
            tercer.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Els teus drets
          </h2>
          <p>
            Segons el RGPD pots accedir, corregir, esborrar o portar-te les teves
            dades. Hi ha un botó "Esborrar compte" a <a href="/settings" className="text-peach-deep underline">/settings</a> que
            elimina tot el contingut on ets propietari. Per a una exportació
            completa o consultes, contacta'ns per correu.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Conservació
          </h2>
          <p>
            Mantenim les teves dades mentre tinguis compte. Quan l'esborres,
            eliminem els plans que només eren teus immediatament; els plans
            compartits queden amb el primer co-editor més antic.
          </p>
        </section>
      </div>
    </article>
  );
}
