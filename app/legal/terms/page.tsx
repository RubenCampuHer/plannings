import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condicions · Plannings",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Condicions d'ús
      </h1>
      <p className="text-ink-soft text-sm mt-1">
        Última actualització: 21 de maig de 2026
      </p>

      <div className="mt-8 space-y-6 text-ink text-[15px] leading-relaxed">
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Beta privada
          </h2>
          <p>
            Plannings està en fase beta. Hi accedeixes per invitació. El servei
            es proporciona "tal qual": podem fer canvis, aturar-lo o introduir
            errors sense avís. Recomanem que no hi guardis informació crítica
            sense còpia de seguretat pròpia.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Què hi pots fer
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Crear plans personals i compartir-los amb persones que tu convidis.</li>
            <li>Pujar contingut propi: text, fotos teves, documents.</li>
            <li>Usar les funcions d'IA quan vulguis per enriquir els teus plans.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Què no hi pots fer
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Pujar contingut il·legal, de menors, de discurs d'odi o que infringeixi
              drets d'autor de tercers.
            </li>
            <li>
              Atacar, sobrecarregar o intentar comprometre el servei.
            </li>
            <li>
              Fer servir el servei per spam, scraping o suplantació d'identitat.
            </li>
          </ul>
          <p>
            Ens reservem el dret de tancar comptes que incompleixin aquestes
            normes sense més preavís.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Propietat
          </h2>
          <p>
            El contingut que crees és teu. Tu ens dones permís per emmagatzemar-lo
            i mostrar-lo al servei i a les persones a qui tu convides. No fem
            servir el teu contingut per entrenar models ni per cap altre fi.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink">
            Contacte
          </h2>
          <p>
            Per a qualsevol qüestió:{" "}
            <a href="mailto:ruben@aima.chat" className="text-peach-deep underline">
              ruben@aima.chat
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
