import {
  simpleProductFactory,
  simpleRegionFactory,
} from "../../../../factories"

import { IPricingModuleService } from "@medusajs/types"
import adminSeeder from "../../../../helpers/admin-seeder"
import { createDefaultRuleTypes } from "../../../helpers/create-default-rule-types"
import { createVariantPriceSet } from "../../../helpers/create-variant-price-set"
import { medusaIntegrationTestRunner } from "medusa-test-utils"

jest.setTimeout(50000)

const adminHeaders = {
  headers: {
    "x-medusa-access-token": "test_token",
  },
}

const env = {
  MEDUSA_FF_MEDUSA_V2: true,
}

medusaIntegrationTestRunner({
  env,
  testSuite: ({ dbConnection, getContainer, api }) => {
    describe.skip("DELETE /admin/price-lists/:id", () => {
      let appContainer
      let product
      let variant
      let pricingModuleService: IPricingModuleService

      beforeAll(async () => {
        appContainer = getContainer()
        pricingModuleService = appContainer.resolve("pricingModuleService")
      })

      beforeEach(async () => {
        await adminSeeder(dbConnection)
        await createDefaultRuleTypes(appContainer)

        await simpleRegionFactory(dbConnection, {
          id: "test-region",
          name: "Test Region",
          currency_code: "usd",
          tax_rate: 0,
        })

        product = await simpleProductFactory(dbConnection, {
          id: "test-product-with-variant",
          variants: [
            {
              options: [{ option_id: "test-product-option-1", value: "test" }],
            },
          ],
          options: [
            {
              id: "test-product-option-1",
              title: "Test option 1",
            },
          ],
        })

        variant = product.variants[0]
      })

      it("should delete price list and money amounts", async () => {
        const priceSet = await createVariantPriceSet({
          container: appContainer,
          variantId: variant.id,
          prices: [
            {
              amount: 3000,
              currency_code: "usd",
            },
          ],
        })

        const data = {
          name: "test price list",
          description: "test",
          type: "override",
          customer_groups: [],
          status: "active",
          prices: [
            {
              amount: 400,
              variant_id: variant.id,
              currency_code: "usd",
            },
          ],
        }

        const result = await api.post(`admin/price-lists`, data, adminHeaders)
        const priceListId = result.data.price_list.id

        const getResponse = await api.get(
          `/admin/price-lists/${priceListId}`,
          adminHeaders
        )
        expect(getResponse.status).toEqual(200)

        let psmas = await pricingModuleService.listPriceSetMoneyAmounts({
          price_list_id: [priceListId],
        })
        expect(psmas.length).toEqual(1)

        const deleteRes = await api.delete(
          `/admin/price-lists/${priceListId}`,
          adminHeaders
        )
        expect(deleteRes.status).toEqual(200)

        const afterDelete = await api
          .get(`/admin/price-lists/${priceListId}`, adminHeaders)
          .catch((err) => {
            return err
          })
        expect(afterDelete.response.status).toEqual(404)

        psmas = await pricingModuleService.listPriceSetMoneyAmounts({
          price_list_id: [priceListId],
        })
        expect(psmas.length).toEqual(0)
      })
    })
  },
})
