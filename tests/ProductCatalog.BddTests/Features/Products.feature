Feature: Product catalog
  Clients keep the catalog in sync. They can browse products together with
  the stock that is actually available, change a product, and adjust stock
  without driving it negative.

  Scenario: Listing products includes the available stock
    When I list products
    Then the response status is 200
    And every product in the list includes a stock figure

  Scenario: Fetching one product returns its stock
    When I fetch product 100001
    Then the response status is 200
    And the product name is "Primo Star"
    And the available stock is 6

  Scenario: An unknown product is a 404
    When I fetch product 424242
    Then the response status is 404

  Scenario: A valid product is created with a generated 6-digit id
    When I create a product named "Lens cloth" priced at "12.50" with stock 20 in category 3
    Then the response status is 201
    And the product id is a 6-digit number
    And the product id is greater than 100008
    And the available stock is 20
    And the response location header identifies that product

  Scenario: Two creates never share an id
    When I create a product named "Cloth A" priced at "5" with stock 1 in category 3
    And I remember the product id
    When I create a product named "Cloth B" priced at "6" with stock 2 in category 3
    Then the product id is a 6-digit number
    And the product id is not the one I remembered

  Scenario: A missing name explains which field failed
    When I create a product named "" priced at "10" with stock 1 in category 1
    Then the response status is 400
    And the error payload mentions "name"

  Scenario Outline: Invalid products are rejected
    When I create a product named "<name>" priced at "<price>" with stock <stock> in category <category>
    Then the response status is 400

    Examples:
      | name         | price  | stock | category |
      | Lens cloth   | 0      | 1     | 1        |
      | Lens cloth   | 10.555 | 1     | 1        |
      | Lens cloth   | 10     | -5    | 1        |
      | Lens cloth   | 10     | 1     | 999      |

  Scenario: A product can be renamed and repriced
    When I update product 100001 with name "Primo Star HD", price "2599.00", stock 6 and category 1
    Then the response status is 200
    And the product name is "Primo Star HD"
    And the available stock is 6

  Scenario: Updating a missing product is a 404
    When I update product 424242 with name "Ghost", price "10", stock 1 and category 1
    Then the response status is 404

  Scenario: Deleting a product removes it
    When I delete product 100006
    Then the response status is 204
    When I fetch product 100006
    Then the response status is 404

  Scenario: Searching by name is a partial, case-insensitive match
    When I search products by name "STAR"
    Then the response status is 200
    And the list contains "Primo Star"
    And the list does not contain "Stemi 305"

  Scenario: Stock level bounds are inclusive
    When I ask for products with stock between 2 and 4
    Then the response status is 200
    And the list contains "Axiocam 208 color"
    And the list contains "Stemi 305"
    And the list does not contain "Primo Star"
    And the list does not contain "LED illuminator"

  Scenario: An inverted stock range is rejected
    When I ask for products with stock between 10 and 1
    Then the response status is 400

  Scenario: Decrementing stock returns the new level
    When I decrement stock of product 100005 by 5
    Then the response status is 200
    And the available stock is 35

  Scenario: Stock cannot be decremented below zero
    When I decrement stock of product 100003 by 3
    Then the response status is 409
    When I fetch product 100003
    Then the available stock is 2

  Scenario: Adding stock increases what is available
    When I add 4 to the stock of product 100007
    Then the response status is 200
    And the available stock is 4

  Scenario: A zero quantity adjustment is rejected
    When I decrement stock of product 100001 by 0
    Then the response status is 400

  Scenario: Seeded categories can be listed
    When I list categories
    Then the response status is 200
    And the list contains "Microscopes"
